import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { AssetsRepository } from './assets.repository';
import { MorningstarResolverService, PageVerifierService } from './resolver';
import { IsinEnrichmentService } from './isin-enrichment.service';
import { MS_ASSET_TYPES } from './resolver/utils/constants';
import {
  ResolveAssetDto,
  ConfirmAssetDto,
  BatchResolveAssetDto,
  BatchResolveAssetItemDto,
  AssetTypeDto,
} from './dto';
import { Asset, AssetSource, AssetType } from '@prisma/client';
import {
  IdentifierClassifier,
  IdentifierType,
} from '../common/utils/identifier-classifier';
import { createContextLogger } from '../common/logger';
import { EntityNotFoundException } from '../common/exceptions';
import { CACHE_CONFIG } from '../common/constants';
import { IAssetsService } from './interfaces';
import {
  ResolveAssetResponse,
  ResolutionSource,
  ResolutionErrorCode,
  BatchResolveAssetResponse,
  BatchResolveResultItem,
  ResolvedAssetDto,
} from './types';
import { toResolvedAssetDto } from './mappers';
import type { AppConfig } from '../config';

@Injectable()
export class AssetsService implements IAssetsService {
  private readonly logger = createContextLogger(AssetsService.name);
  private readonly batchConcurrencyLimit: number;
  private readonly maxAlternatives: number;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly assetsRepository: AssetsRepository,
    private readonly morningstarResolver: MorningstarResolverService,
    private readonly isinEnrichmentService: IsinEnrichmentService,
    private readonly pageVerifier: PageVerifierService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    const resolutionConfig = this.configService.get('resolution', {
      infer: true,
    });
    this.batchConcurrencyLimit = resolutionConfig.batchConcurrencyLimit;
    this.maxAlternatives = resolutionConfig.maxAlternatives;
  }

  async resolve(dto: ResolveAssetDto): Promise<ResolveAssetResponse> {
    // Input is already normalized (trimmed & uppercased) by DTO Transform decorator
    const input = dto.input;
    const identifierType = IdentifierClassifier.classify(input);
    const cacheKey = `${CACHE_CONFIG.ASSET_KEY_PREFIX}${input}`;

    // Step 0: Check in-memory cache first (fastest) ONLY for strong identifiers
    // (ISIN and Morningstar ID). For tickers or free-text we always require
    // explicit user confirmation, so we skip the cache.
    const shouldUseCacheForIdentifier =
      identifierType === IdentifierType.ISIN ||
      identifierType === IdentifierType.MORNINGSTAR_ID;

    const memoryCached = shouldUseCacheForIdentifier
      ? await this.cacheManager.get<ResolveAssetResponse>(cacheKey)
      : null;
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
          source: ResolutionSource.CACHE,
          asset: toResolvedAssetDto(cachedAsset),
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
        // For any input that is NOT a strong identifier (ISIN or Morningstar ID)
        // - e.g. ticker or free-text like "gold" - always require user confirmation
        // instead of auto-adding the asset.
        if (
          identifierType !== IdentifierType.ISIN &&
          identifierType !== IdentifierType.MORNINGSTAR_ID
        ) {
          const resultsWithId = resolution.allResults.filter(
            (r) => r.morningstarId,
          );
          const sourceResults =
            resultsWithId.length > 0
              ? resultsWithId
              : resolution.bestMatch
                ? [resolution.bestMatch]
                : [];
          const alternatives = sourceResults
            .slice(0, this.maxAlternatives)
            .map((r) => ({
              morningstarId: r.morningstarId!,
              name: r.title,
              url: r.url,
              score: r.score,
              ticker: r.ticker,
              assetType: this.mapAssetType(r.assetType),
              market: this.detectMarketFromUrl(r.url),
            }));
          this.logger.log(
            `Match for non-identifier input "${input}" -> requiring confirmation (${alternatives.length} option(s))`,
          );
          return {
            success: false,
            source: ResolutionSource.MANUAL_REQUIRED,
            errorCode: ResolutionErrorCode.AMBIGUOUS_MATCH,
            alternatives,
            error: `Asset found by name for "${input}". Please confirm it is the correct one.`,
          };
        }

        // Auto-save to cache for future lookups (ISIN, Morningstar ID, or Ticker)
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

        // For stocks, we persist the ticker when available.
        // For funds and ETFs we do NOT store the ticker in the database.
        const tickerForStock =
          resolution.verification?.additionalInfo?.ticker ??
          resolution.bestMatch?.ticker;

        const savedAsset = await this.assetsRepository.upsertByMorningstarId({
          isin: isin,
          morningstarId: resolution.morningstarId,
          name: fundName,
          type: assetType,
          url: resolution.morningstarUrl || '',
          source: AssetSource.web_search,
          ticker: assetType === AssetType.STOCK ? tickerForStock : undefined,
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
          source: ResolutionSource.RESOLVED,
          asset: toResolvedAssetDto(savedAsset),
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
          .slice(0, this.maxAlternatives)
          .map((r) => ({
            morningstarId: r.morningstarId!,
            name: r.title,
            url: r.url,
            score: r.score,
            ticker: r.ticker,
            // Map internal assetType (Spanish) to API enum (English)
            assetType: this.mapAssetType(r.assetType),
            market: this.detectMarketFromUrl(r.url),
          }));

        return {
          success: false,
          source: ResolutionSource.MANUAL_REQUIRED,
          errorCode: ResolutionErrorCode.AMBIGUOUS_MATCH,
          alternatives,
          error: `Asset "${input}" found but needs confirmation. Confidence: ${(resolution.confidence * 100).toFixed(1)}%`,
        };
      }

      // Not found
      return {
        success: false,
        source: ResolutionSource.MANUAL_REQUIRED,
        errorCode: ResolutionErrorCode.NOT_FOUND,
        error: `Asset with identifier "${input}" not found. Please provide Morningstar ID manually.`,
      };
    } catch (error) {
      const { errorCode, message } = this.categorizeResolutionError(
        error,
        input,
      );
      // Log as warn since this is a handled/expected error, not a system failure
      // The error details are captured in errorCode and returned to the client
      this.logger.warn(
        `Resolution failed for "${input}": [${errorCode}] ${message}`,
      );
      return {
        success: false,
        source: ResolutionSource.MANUAL_REQUIRED,
        errorCode,
        error: message,
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
    const resolvedResults = new Map<string, ResolveAssetResponse>();

    for (let i = 0; i < uncachedItems.length; i += this.batchConcurrencyLimit) {
      const batch = uncachedItems.slice(i, i + this.batchConcurrencyLimit);
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
          source: ResolutionSource.MANUAL_REQUIRED,
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
      (r) =>
        !r.result.success &&
        r.result.source === ResolutionSource.MANUAL_REQUIRED,
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
   * Strategy:
   * 1. Check in-memory cache first (fastest)
   * 2. For cache misses, batch query database by type (ISINs and Morningstar IDs)
   */
  private async batchCacheLookup(
    classifiedInputs: Array<{
      original: BatchResolveAssetItemDto;
      normalized: string;
      type: IdentifierType;
    }>,
  ): Promise<Map<string, ResolveAssetResponse>> {
    const results = new Map<string, ResolveAssetResponse>();

    // Step 1: Check in-memory cache first (parallel lookups)
    const memoryCachePromises = classifiedInputs.map(async (item) => {
      const cacheKey = `${CACHE_CONFIG.ASSET_KEY_PREFIX}${item.normalized}`;
      const cached =
        await this.cacheManager.get<ResolveAssetResponse>(cacheKey);
      return { normalized: item.normalized, cached };
    });

    const memoryCacheResults = await Promise.all(memoryCachePromises);
    const memoryHits = new Set<string>();

    for (const { normalized, cached } of memoryCacheResults) {
      if (cached) {
        results.set(normalized, cached);
        memoryHits.add(normalized);
      }
    }

    if (memoryHits.size > 0) {
      this.logger.debug(
        `[BATCH] Memory cache hits: ${memoryHits.size}/${classifiedInputs.length}`,
      );
    }

    // Step 2: Filter out memory cache hits for DB lookup
    const uncachedInputs = classifiedInputs.filter(
      (i) => !memoryHits.has(i.normalized),
    );

    if (uncachedInputs.length === 0) {
      return results;
    }

    // Separate inputs by type for batch DB queries
    const isins = uncachedInputs
      .filter((i) => i.type === IdentifierType.ISIN)
      .map((i) => i.normalized);

    const morningstarIds = uncachedInputs
      .filter((i) => i.type === IdentifierType.MORNINGSTAR_ID)
      .map((i) => i.normalized);

    // Batch query for Morningstar IDs with parallel cache writes
    if (morningstarIds.length > 0) {
      const msAssets =
        await this.assetsRepository.findManyByMorningstarIds(morningstarIds);

      const cachePromises: Promise<unknown>[] = [];

      for (const asset of msAssets) {
        // Skip if needs re-resolution (no ISIN and enrichment complete)
        if (!asset.isin && !asset.isinPending) continue;

        const response: ResolveAssetResponse = {
          success: true,
          source: ResolutionSource.CACHE,
          asset: toResolvedAssetDto(asset),
          isinPending: asset.isinPending,
        };
        results.set(asset.morningstarId.toUpperCase(), response);

        // Queue cache write for parallel execution
        const cacheKey = `${CACHE_CONFIG.ASSET_KEY_PREFIX}${asset.morningstarId.toUpperCase()}`;
        cachePromises.push(this.cacheManager.set(cacheKey, response));
      }

      // Execute all cache writes in parallel
      await Promise.all(cachePromises);
    }

    // Batch query for ISINs with parallel cache writes
    if (isins.length > 0) {
      const isinAssets = await this.assetsRepository.findManyByIsins(isins);

      const cachePromises: Promise<unknown>[] = [];

      for (const asset of isinAssets) {
        // Skip if needs re-resolution (no ISIN and enrichment complete)
        if (!asset.isin && !asset.isinPending) continue;

        if (asset.isin) {
          const response: ResolveAssetResponse = {
            success: true,
            source: ResolutionSource.CACHE,
            asset: toResolvedAssetDto(asset),
            isinPending: asset.isinPending,
          };
          results.set(asset.isin.toUpperCase(), response);

          // Queue cache write for parallel execution
          const cacheKey = `${CACHE_CONFIG.ASSET_KEY_PREFIX}${asset.isin.toUpperCase()}`;
          cachePromises.push(this.cacheManager.set(cacheKey, response));
        }
      }

      // Execute all cache writes in parallel
      await Promise.all(cachePromises);
    }

    return results;
  }

  async getById(id: string): Promise<ResolvedAssetDto> {
    const asset = await this.assetsRepository.findById(id);
    if (!asset) {
      throw new EntityNotFoundException('Asset', id);
    }
    return toResolvedAssetDto(asset);
  }

  async confirm(dto: ConfirmAssetDto): Promise<ResolvedAssetDto> {
    // If no ticker provided and it's a STOCK, try to extract from page
    let ticker = dto.ticker;
    if (!ticker && dto.type === AssetTypeDto.STOCK) {
      this.logger.log(
        `[CONFIRM] No ticker provided for STOCK ${dto.morningstarId}, attempting extraction...`,
      );
      try {
        const { verification } =
          await this.pageVerifier.verifyFundPageWithFallback(
            dto.morningstarId,
            '',
            MS_ASSET_TYPES.STOCK,
          );
        if (verification.additionalInfo?.ticker) {
          ticker = verification.additionalInfo.ticker;
          this.logger.log(`[CONFIRM] Extracted ticker from page: ${ticker}`);
        }
      } catch (error) {
        this.logger.warn(
          `[CONFIRM] Failed to extract ticker for ${dto.morningstarId}: ${error}`,
        );
      }
    }

    const isStock = dto.type === AssetTypeDto.STOCK;

    // Create or update asset with manual source
    // Use upsertByMorningstarId since ISIN may be undefined (e.g., when found by ticker)
    const asset = await this.assetsRepository.upsertByMorningstarId({
      isin: dto.isin ?? null,
      morningstarId: dto.morningstarId,
      name: dto.name,
      type: dto.type as AssetType,
      url: dto.url,
      source: AssetSource.manual,
      // Only persist ticker for stocks; funds/ETFs should not store ticker in DB
      ticker: isStock ? ticker : undefined,
      isinPending: !dto.isin, // Mark as pending if no ISIN provided
    });

    // Invalidate cache for all identifiers (ISIN, Morningstar ID, and ticker)
    await this.invalidateAssetCache({
      isin: dto.isin ?? undefined,
      morningstarId: dto.morningstarId,
      ticker: asset.ticker,
    });

    return toResolvedAssetDto(asset);
  }

  /**
   * Update ISIN for an existing asset (manual entry by user)
   * Uses transactional method to ensure atomicity between existence check and update
   * @param id - Asset UUID
   * @param isin - New ISIN value
   * @throws EntityNotFoundException if asset not found (returns 404 automatically)
   */
  async updateIsin(id: string, isin: string): Promise<ResolvedAssetDto> {
    this.logger.log(`Manually updating ISIN for asset ${id}: ${isin}`);

    // Repository throws EntityNotFoundException (extends NotFoundException)
    // which is automatically handled by NestJS and returns 404
    const asset = await this.assetsRepository.updateIsinWithVerification(
      id,
      isin,
      true, // Mark as manually entered
    );

    // Invalidate cache for all identifiers
    await this.invalidateAssetCache({
      isin,
      morningstarId: asset.morningstarId,
      ticker: asset.ticker,
    });

    return toResolvedAssetDto(asset);
  }

  /**
   * Update ticker for an existing asset (manual entry by user)
   * Primarily used for stocks where ticker is not automatically resolved
   * Uses transactional method to ensure atomicity between existence check and update
   * @param id - Asset UUID
   * @param ticker - New ticker value
   * @throws EntityNotFoundException if asset not found (returns 404 automatically)
   */
  async updateTicker(id: string, ticker: string): Promise<ResolvedAssetDto> {
    this.logger.log(`Manually updating ticker for asset ${id}: ${ticker}`);

    // Repository throws EntityNotFoundException (extends NotFoundException)
    // which is automatically handled by NestJS and returns 404
    const asset = await this.assetsRepository.updateTickerWithVerification(
      id,
      ticker,
      true, // Mark as manually entered
    );

    // Invalidate cache for all identifiers
    await this.invalidateAssetCache({
      isin: asset.isin,
      morningstarId: asset.morningstarId,
      ticker,
    });

    return toResolvedAssetDto(asset);
  }

  /**
   * Invalidate in-memory cache for an asset
   * Supports all identifier types that can be used as cache keys
   * @param options - Object containing optional identifiers to invalidate
   */
  private async invalidateAssetCache(options: {
    isin?: string | null;
    morningstarId?: string;
    ticker?: string | null;
  }): Promise<void> {
    const { isin, morningstarId, ticker } = options;
    const keys: string[] = [];

    if (isin)
      keys.push(`${CACHE_CONFIG.ASSET_KEY_PREFIX}${isin.toUpperCase()}`);
    if (morningstarId)
      keys.push(
        `${CACHE_CONFIG.ASSET_KEY_PREFIX}${morningstarId.toUpperCase()}`,
      );
    if (ticker)
      keys.push(`${CACHE_CONFIG.ASSET_KEY_PREFIX}${ticker.toUpperCase()}`);

    if (keys.length === 0) return;

    // Invalidate all keys in parallel for better performance
    await Promise.all(
      keys.map(async (key) => {
        await this.cacheManager.del(key);
        this.logger.debug(`[CACHE] Invalidated: ${key}`);
      }),
    );
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

  /**
   * Categorize resolution errors for better client handling
   * @param error - The caught error
   * @param input - The input that was being resolved
   * @returns Error code and user-friendly message
   */
  /**
   * Detect market/exchange from Morningstar URL
   * Extracts market ID from URL patterns like:
   * - /es/inversiones/... (Spanish market)
   * - /en-eu/investments/...?marketID=us (EU market with marketID param)
   * - /en/investments/... (English market, likely US)
   */
  private detectMarketFromUrl(url: string): string | undefined {
    try {
      const urlObj = new URL(url);

      // Check for marketID parameter (e.g., ?marketID=us)
      const marketIdParam = urlObj.searchParams.get('marketID');
      if (marketIdParam) {
        return marketIdParam.toUpperCase();
      }

      // Check URL path for market indicators
      const path = urlObj.pathname.toLowerCase();

      // Spanish market: /es/inversiones/...
      if (path.includes('/es/inversiones/')) {
        return 'ES';
      }

      // EU market: /en-eu/investments/...
      if (path.includes('/en-eu/investments/')) {
        // Try to infer from domain or default to EU
        return 'EU';
      }

      // English market: /en/investments/... (often US)
      if (path.includes('/en/investments/')) {
        // Check if it's a US domain
        if (
          urlObj.hostname.includes('morningstar.com') &&
          !urlObj.hostname.includes('morningstar.es')
        ) {
          return 'US';
        }
        return 'GB'; // Default to UK for English
      }

      // Check domain for market hints
      if (urlObj.hostname.includes('morningstar.es')) {
        return 'ES';
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private categorizeResolutionError(
    error: unknown,
    input: string,
  ): { errorCode: ResolutionErrorCode; message: string } {
    const errorMessage =
      error instanceof Error ? error.message.toLowerCase() : String(error);

    // Check for timeout errors
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out')
    ) {
      return {
        errorCode: ResolutionErrorCode.TIMEOUT,
        message: `Resolution timed out for "${input}". Please try again.`,
      };
    }

    // Check for network errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('fetch failed')
    ) {
      return {
        errorCode: ResolutionErrorCode.NETWORK_ERROR,
        message: `Network error while resolving "${input}". Please check your connection and try again.`,
      };
    }

    // Check for circuit breaker open (service unavailable)
    if (
      errorMessage.includes('circuit') ||
      errorMessage.includes('service unavailable')
    ) {
      return {
        errorCode: ResolutionErrorCode.SERVICE_UNAVAILABLE,
        message: `Service temporarily unavailable. Please try again in a few moments.`,
      };
    }

    // Default to unknown error
    return {
      errorCode: ResolutionErrorCode.UNKNOWN,
      message: `Error resolving asset "${input}". Please try again or provide Morningstar ID manually.`,
    };
  }
}
