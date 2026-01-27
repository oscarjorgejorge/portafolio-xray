import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AssetsRepository } from './assets.repository';
import { MorningstarResolverService } from './resolver';
import { IsinEnrichmentService } from './isin-enrichment.service';
import {
  ResolveAssetDto,
  ConfirmAssetDto,
  BatchResolveAssetDto,
  BatchResolveAssetItemDto,
} from './dto';
import { Asset, AssetSource, AssetType } from '@prisma/client';
import {
  IdentifierClassifier,
  IdentifierType,
} from '../common/utils/identifier-classifier';
import { IAssetsService } from './interfaces';
import {
  ResolveAssetResponse,
  BatchResolveAssetResponse,
  BatchResolveResultItem,
} from './types';

/** Cache key prefix for asset resolution results */
const CACHE_KEY_PREFIX = 'asset:';

@Injectable()
export class AssetsService implements IAssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly assetsRepository: AssetsRepository,
    private readonly morningstarResolver: MorningstarResolverService,
    private readonly isinEnrichmentService: IsinEnrichmentService,
  ) {}

  async resolve(dto: ResolveAssetDto): Promise<ResolveAssetResponse> {
    // Input is already normalized (trimmed & uppercased) by DTO Transform decorator
    const input = dto.input;
    const identifierType = IdentifierClassifier.classify(input);
    const cacheKey = `${CACHE_KEY_PREFIX}${input}`;

    // Step 0: Check in-memory cache first (fastest)
    const memoryCached =
      await this.cacheManager.get<ResolveAssetResponse>(cacheKey);
    if (memoryCached) {
      this.logger.debug(`[MEMORY CACHE] Hit for: ${input}`);
      return memoryCached;
    }

    // Step 1: Search in database cache
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
        this.logger.log(`[DB CACHE] Hit for: ${input}`);
        const response: ResolveAssetResponse = {
          success: true,
          source: 'cache',
          asset: cachedAsset,
          isinPending: cachedAsset.isinPending,
        };
        // Store in memory cache for faster subsequent access
        await this.cacheManager.set(cacheKey, response);
        return response;
      }

      this.logger.log(
        `[DB CACHE] Hit for: ${input}, but ISIN missing - attempting re-resolution`,
      );
      // Continue to re-resolution logic below
    }

    // Step 2: If not in cache, use Morningstar resolver
    this.logger.log(`[CACHE MISS] for: ${input}, resolving externally...`);

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

        const response: ResolveAssetResponse = {
          success: true,
          source: 'resolved',
          asset: savedAsset,
          isinPending: needsIsinEnrichment,
        };

        // Cache successful resolutions in memory (only if not pending enrichment)
        if (!needsIsinEnrichment) {
          await this.cacheManager.set(cacheKey, response);
        }

        return response;
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

  /**
   * Batch resolve multiple assets in a single request
   * Optimized to reduce N+1 API calls from the frontend
   *
   * Strategy:
   * 1. Batch cache lookup for all ISINs and Morningstar IDs
   * 2. Process uncached items in parallel with concurrency control
   * 3. Return all results together
   *
   * @param dto - Batch resolve request with up to 20 assets
   */
  async resolveBatch(
    dto: BatchResolveAssetDto,
  ): Promise<BatchResolveAssetResponse> {
    const startTime = Date.now();
    this.logger.log(
      `[BATCH] Starting batch resolution for ${dto.assets.length} assets`,
    );

    // Step 1: Classify all inputs and prepare for batch cache lookup
    // Inputs are already normalized (trimmed & uppercased) by DTO Transform decorator
    const classifiedInputs = dto.assets.map((item) => ({
      original: item,
      normalized: item.input,
      type: IdentifierClassifier.classify(item.input),
    }));

    // Step 2: Batch cache lookup
    const cacheResults = await this.batchCacheLookup(classifiedInputs);

    // Step 3: Identify uncached items
    const uncachedItems = classifiedInputs.filter(
      (item) => !cacheResults.has(item.normalized),
    );

    this.logger.log(
      `[BATCH] Cache hits: ${cacheResults.size}, Cache misses: ${uncachedItems.length}`,
    );

    // Step 4: Resolve uncached items in parallel with concurrency control
    const CONCURRENCY_LIMIT = 5; // Avoid overwhelming external APIs
    const resolvedResults = new Map<string, ResolveAssetResponse>();

    for (let i = 0; i < uncachedItems.length; i += CONCURRENCY_LIMIT) {
      const batch = uncachedItems.slice(i, i + CONCURRENCY_LIMIT);
      const batchPromises = batch.map(async (item) => {
        const result = await this.resolve({
          input: item.original.input,
          assetType: item.original.assetType,
        });
        return { normalized: item.normalized, result };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ normalized, result }) => {
        resolvedResults.set(normalized, result);
      });
    }

    // Step 5: Combine results in original order
    const results: BatchResolveResultItem[] = classifiedInputs.map((item) => {
      const cachedResult = cacheResults.get(item.normalized);
      const resolvedResult = resolvedResults.get(item.normalized);
      const result = cachedResult ||
        resolvedResult || {
          success: false,
          source: 'manual_required' as const,
          error: 'Resolution failed unexpectedly',
        };

      return {
        input: item.original.input,
        result,
      };
    });

    // Step 6: Calculate statistics
    const resolved = results.filter((r) => r.result.success).length;
    const manualRequired = results.filter(
      (r) => !r.result.success && r.result.source === 'manual_required',
    ).length;

    const duration = Date.now() - startTime;
    this.logger.log(
      `[BATCH] Completed batch resolution in ${duration}ms: ${resolved} resolved, ${manualRequired} manual required`,
    );

    return {
      total: dto.assets.length,
      resolved,
      manualRequired,
      results,
    };
  }

  /**
   * Perform batch cache lookup for multiple inputs
   * Optimizes database queries by batching ISINs and Morningstar IDs separately
   */
  private async batchCacheLookup(
    classifiedInputs: Array<{
      original: BatchResolveAssetItemDto;
      normalized: string;
      type: IdentifierType;
    }>,
  ): Promise<Map<string, ResolveAssetResponse>> {
    const results = new Map<string, ResolveAssetResponse>();

    // Separate inputs by type for batch queries
    const isins = classifiedInputs
      .filter((i) => i.type === IdentifierType.ISIN)
      .map((i) => i.normalized);

    const morningstarIds = classifiedInputs
      .filter((i) => i.type === IdentifierType.MORNINGSTAR_ID)
      .map((i) => i.normalized);

    // Batch query for Morningstar IDs
    if (morningstarIds.length > 0) {
      const msAssets =
        await this.assetsRepository.findManyByMorningstarIds(morningstarIds);
      for (const asset of msAssets) {
        // Skip if needs re-resolution (no ISIN and enrichment complete)
        if (!asset.isin && !asset.isinPending) continue;

        results.set(asset.morningstarId.toUpperCase(), {
          success: true,
          source: 'cache',
          asset,
          isinPending: asset.isinPending,
        });
      }
    }

    // Batch query for ISINs (single query instead of N queries)
    if (isins.length > 0) {
      const isinAssets = await this.assetsRepository.findManyByIsins(isins);
      for (const asset of isinAssets) {
        // Skip if needs re-resolution (no ISIN and enrichment complete)
        if (!asset.isin && !asset.isinPending) continue;

        if (asset.isin) {
          results.set(asset.isin.toUpperCase(), {
            success: true,
            source: 'cache',
            asset,
            isinPending: asset.isinPending,
          });
        }
      }
    }

    return results;
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
    const asset = await this.assetsRepository.upsertByIsin({
      isin: dto.isin,
      morningstarId: dto.morningstarId,
      name: dto.name,
      type: dto.type as AssetType,
      url: dto.url,
      source: AssetSource.manual,
      ticker: dto.ticker,
    });

    // Invalidate cache for both ISIN and Morningstar ID
    await this.invalidateAssetCache(dto.isin, dto.morningstarId);

    return asset;
  }

  /**
   * Update ISIN for an existing asset (manual entry by user)
   * Uses transactional method to ensure atomicity between existence check and update
   * @param id - Asset UUID
   * @param isin - New ISIN value
   */
  async updateIsin(id: string, isin: string): Promise<Asset> {
    this.logger.log(`Manually updating ISIN for asset ${id}: ${isin}`);

    try {
      // Use transactional method to ensure atomicity
      const asset = await this.assetsRepository.updateIsinWithVerification(
        id,
        isin,
        true,
      ); // Mark as manually entered

      // Invalidate cache for ISIN and Morningstar ID
      await this.invalidateAssetCache(isin, asset.morningstarId);

      return asset;
    } catch (error) {
      // Convert repository error to NestJS NotFoundException
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(`Asset with id "${id}" not found`);
      }
      throw error;
    }
  }

  /**
   * Invalidate in-memory cache for an asset
   * @param isin - Optional ISIN to invalidate
   * @param morningstarId - Optional Morningstar ID to invalidate
   */
  private async invalidateAssetCache(
    isin?: string | null,
    morningstarId?: string,
  ): Promise<void> {
    const keys: string[] = [];
    if (isin) keys.push(`${CACHE_KEY_PREFIX}${isin.toUpperCase()}`);
    if (morningstarId)
      keys.push(`${CACHE_KEY_PREFIX}${morningstarId.toUpperCase()}`);

    for (const key of keys) {
      await this.cacheManager.del(key);
      this.logger.debug(`[CACHE] Invalidated: ${key}`);
    }
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
