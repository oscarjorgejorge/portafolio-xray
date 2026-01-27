import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { AssetsRepository } from './assets.repository';
import { MorningstarResolverService } from './resolver';
import { IsinEnrichmentService } from './isin-enrichment.service';
import { ResolveAssetDto, ConfirmAssetDto } from './dto';
import { Asset, AssetSource, AssetType } from '@prisma/client';
import {
  IdentifierClassifier,
  IdentifierType,
} from '../common/utils/identifier-classifier';
import { IAssetsService, ResolveAssetResponse } from './interfaces';

@Injectable()
export class AssetsService implements IAssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly assetsRepository: AssetsRepository,
    private readonly morningstarResolver: MorningstarResolverService,
    private readonly isinEnrichmentService: IsinEnrichmentService,
  ) {}

  async resolve(dto: ResolveAssetDto): Promise<ResolveAssetResponse> {
    const input = dto.input.trim().toUpperCase();
    const identifierType = IdentifierClassifier.classify(input);

    // Step 1: Search in cache
    let cachedAsset: Asset | null = null;

    if (identifierType === IdentifierType.ISIN) {
      cachedAsset = await this.assetsRepository.findByIsin(input);
    } else if (identifierType === IdentifierType.MORNINGSTAR_ID) {
      cachedAsset = await this.assetsRepository.findByMorningstarId(input);
    }

    if (cachedAsset) {
      // If cached asset has no ISIN and enrichment is complete (failed), re-resolve to try again
      const needsReResolution = !cachedAsset.isin && !cachedAsset.isinPending;

      if (!needsReResolution) {
        this.logger.log(`Cache hit for: ${input}`);
        return {
          success: true,
          source: 'cache',
          asset: cachedAsset,
          isinPending: cachedAsset.isinPending,
        };
      }

      this.logger.log(
        `Cache hit for: ${input}, but ISIN missing - attempting re-resolution`,
      );
      // Continue to re-resolution logic below
    }

    // Step 2: If not in cache, use Morningstar resolver
    this.logger.log(`Cache miss for: ${input}, resolving externally...`);

    try {
      const resolution = await this.morningstarResolver.resolve(input);

      if (resolution.status === 'resolved' && resolution.morningstarId) {
        // Auto-save to cache for future lookups
        const assetType = this.mapAssetType(
          resolution.bestMatch?.assetType,
          dto.assetType,
        );

        const fundName =
          resolution.bestMatch?.title ||
          resolution.verification?.nameFound ||
          'Unknown';

        // Use the input as ISIN only if it's an ISIN, otherwise use:
        // 1. ISIN from search result (API response)
        // 2. ISIN found during page verification
        // 3. null (will be enriched asynchronously)
        // IMPORTANT: Always validate ISIN format before storing - the Morningstar API
        // sometimes returns garbage in the isin field (e.g., "CANADAFRENCH" for stocks)
        const candidateIsin =
          identifierType === IdentifierType.ISIN
            ? input
            : resolution.bestMatch?.isin ||
              resolution.verification?.isinFound ||
              null;

        // Validate ISIN format AND checksum (ISO 6166 Luhn algorithm)
        // This rejects garbage like "CANADAFRENCH" which passes format check but fails checksum
        const isin =
          candidateIsin &&
          IdentifierClassifier.validateISINChecksum(candidateIsin)
            ? candidateIsin.toUpperCase()
            : null;

        // Log if we rejected an invalid ISIN candidate
        if (candidateIsin && !isin) {
          this.logger.warn(
            `Rejected invalid ISIN candidate "${candidateIsin}" for ${input} - not a valid ISIN format`,
          );
        }

        // Determine if we need to enrich ISIN in background
        const needsIsinEnrichment =
          !isin && identifierType !== IdentifierType.ISIN;

        const savedAsset = await this.assetsRepository.upsertByMorningstarId({
          isin: isin,
          morningstarId: resolution.morningstarId,
          name: fundName,
          type: assetType,
          url: resolution.morningstarUrl || '',
          source: AssetSource.web_search,
          // Prefer ticker from page verification (extracted from URL/title) over API ticker
          // because Morningstar API sometimes returns garbage tickers (e.g., "cv" instead of "CELH")
          ticker:
            resolution.verification?.additionalInfo?.ticker ||
            resolution.bestMatch?.ticker,
          isinPending: needsIsinEnrichment,
        });

        if (isin && identifierType !== IdentifierType.ISIN) {
          this.logger.log(
            `Extracted ISIN: ${isin} (source: ${resolution.bestMatch?.isin ? 'API' : 'page verification'})`,
          );
        }

        this.logger.log(
          `Resolved and cached: ${input} -> ${resolution.morningstarId}${needsIsinEnrichment ? ' (ISIN enrichment pending)' : ''}`,
        );

        // Fire-and-forget: enrich ISIN in background if needed
        if (needsIsinEnrichment) {
          this.isinEnrichmentService.enrichIsinInBackground(
            savedAsset.id,
            fundName,
          );
        }

        return {
          success: true,
          source: 'resolved',
          asset: savedAsset,
          isinPending: needsIsinEnrichment,
        };
      }

      if (
        resolution.status === 'needs_review' &&
        resolution.allResults.length > 0
      ) {
        // Return alternatives for user to pick
        const alternatives = resolution.allResults
          .filter((r) => r.morningstarId)
          .slice(0, 5)
          .map((r) => ({
            morningstarId: r.morningstarId!,
            name: r.title,
            url: r.url,
            score: r.score,
          }));

        return {
          success: false,
          source: 'manual_required',
          alternatives,
          error: `Asset "${input}" found but needs confirmation. Confidence: ${(resolution.confidence * 100).toFixed(1)}%`,
        };
      }

      // Not found
      return {
        success: false,
        source: 'manual_required',
        error: `Asset with identifier "${input}" not found. Please provide Morningstar ID manually.`,
      };
    } catch (error) {
      this.logger.error(`Resolution error for ${input}: ${error}`);
      return {
        success: false,
        source: 'manual_required',
        error: `Error resolving asset "${input}". Please try again or provide Morningstar ID manually.`,
      };
    }
  }

  async getById(id: string): Promise<Asset> {
    const asset = await this.assetsRepository.findById(id);
    if (!asset) {
      throw new NotFoundException(`Asset with id "${id}" not found`);
    }
    return asset;
  }

  async confirm(dto: ConfirmAssetDto): Promise<Asset> {
    // Create or update asset with manual source
    return this.assetsRepository.upsertByIsin({
      isin: dto.isin,
      morningstarId: dto.morningstarId,
      name: dto.name,
      type: dto.type as AssetType,
      url: dto.url,
      source: AssetSource.manual,
      ticker: dto.ticker,
    });
  }

  /**
   * Update ISIN for an existing asset (manual entry by user)
   * @param id - Asset UUID
   * @param isin - New ISIN value
   */
  async updateIsin(id: string, isin: string): Promise<Asset> {
    // First verify the asset exists
    const asset = await this.assetsRepository.findById(id);
    if (!asset) {
      throw new NotFoundException(`Asset with id "${id}" not found`);
    }

    this.logger.log(`Manually updating ISIN for asset ${id}: ${isin}`);
    return this.assetsRepository.updateIsin(id, isin, true); // Mark as manually entered
  }

  /**
   * Map Morningstar asset type to Prisma enum
   */
  private mapAssetType(resolvedType?: string, hintType?: string): AssetType {
    // Priority: resolved type from Morningstar, then user hint
    const typeToCheck = resolvedType || hintType;

    if (!typeToCheck) return AssetType.FUND;

    const normalized = typeToCheck.toUpperCase();

    switch (normalized) {
      case 'ETF':
        return AssetType.ETF;
      case 'STOCK':
      case 'ACCION':
        return AssetType.STOCK;
      case 'ETC':
        return AssetType.ETC;
      case 'FUND':
      case 'FONDO':
      default:
        return AssetType.FUND;
    }
  }
}
