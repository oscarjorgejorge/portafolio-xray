import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { AssetsRepository } from './assets.repository';
import { MorningstarResolverService } from './resolver';
import { ResolveAssetDto, ConfirmAssetDto } from './dto';
import { Asset, AssetSource, AssetType } from '@prisma/client';
import {
  IdentifierClassifier,
  IdentifierType,
} from '../common/utils/identifier-classifier';

export interface ResolveAssetResponse {
  success: boolean;
  source: 'cache' | 'resolved' | 'manual_required';
  asset?: Asset;
  alternatives?: Array<{
    morningstarId: string;
    name: string;
    url: string;
    score: number;
  }>;
  error?: string;
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly assetsRepository: AssetsRepository,
    private readonly morningstarResolver: MorningstarResolverService,
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
      this.logger.log(`Cache hit for: ${input}`);
      return {
        success: true,
        source: 'cache',
        asset: cachedAsset,
      };
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

        const savedAsset = await this.assetsRepository.upsertByIsin({
          isin: identifierType === IdentifierType.ISIN ? input : input,
          morningstarId: resolution.morningstarId,
          name:
            resolution.bestMatch?.title ||
            resolution.verification?.nameFound ||
            'Unknown',
          type: assetType,
          url: resolution.morningstarUrl || '',
          source: AssetSource.web_search,
          ticker: resolution.verification?.additionalInfo?.ticker,
        });

        this.logger.log(
          `Resolved and cached: ${input} -> ${resolution.morningstarId}`,
        );

        return {
          success: true,
          source: 'resolved',
          asset: savedAsset,
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
