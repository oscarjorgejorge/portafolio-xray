import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { AssetsRepository } from './assets.repository';
import { ShareClassLookupService } from './share-class-lookup.service';
import { IShareClassEnrichmentService } from './interfaces/share-class-enrichment.interface';
import { createContextLogger } from '../common/logger';
import { CACHE_CONFIG } from '../common/constants';
import { getErrorMessage } from './resolver/utils/error-handler';
import { needsShareClassEnrichment } from './resolver/utils/canonical-fund-id';
import { SHARE_CLASS_LOOKUP_GAP_MS } from './resolver/utils/constants';
import type { AppConfig } from '../config';

/**
 * Fire-and-forget queue that persists Instant X-Ray F IDs after resolve/confirm.
 * Generate never waits on this work.
 */
@Injectable()
export class ShareClassEnrichmentService implements IShareClassEnrichmentService {
  private readonly logger = createContextLogger(
    ShareClassEnrichmentService.name,
  );
  private readonly maxConcurrentEnrichments: number;
  private readonly activeEnrichments = new Map<string, Promise<void>>();
  private readonly pendingQueue: string[] = [];
  private readonly trackedAssets = new Set<string>();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly assetsRepository: AssetsRepository,
    private readonly shareClassLookup: ShareClassLookupService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    const resolutionConfig = this.configService.get('resolution', {
      infer: true,
    });
    this.maxConcurrentEnrichments =
      resolutionConfig.shareClassEnrichmentConcurrency;
  }

  enrichShareClassInBackground(assetId: string): void {
    if (this.trackedAssets.has(assetId)) {
      this.logger.debug(
        `[SHARE-CLASS] Enrichment already tracked for asset ${assetId}, skipping duplicate`,
      );
      return;
    }

    this.trackedAssets.add(assetId);

    if (this.activeEnrichments.size < this.maxConcurrentEnrichments) {
      this.startEnrichment(assetId);
    } else {
      this.pendingQueue.push(assetId);
      this.logger.debug(
        `[SHARE-CLASS] Queue full (${this.activeEnrichments.size}/${this.maxConcurrentEnrichments}), ` +
          `asset ${assetId} queued (${this.pendingQueue.length} pending)`,
      );
    }
  }

  isEnrichmentInProgress(assetId: string): boolean {
    return this.trackedAssets.has(assetId);
  }

  getActiveEnrichmentCount(): number {
    return this.activeEnrichments.size;
  }

  getPendingEnrichmentCount(): number {
    return this.pendingQueue.length;
  }

  private startEnrichment(assetId: string): void {
    const enrichmentPromise = this.performEnrichment(assetId).finally(() => {
      this.activeEnrichments.delete(assetId);
      this.trackedAssets.delete(assetId);
      this.logger.debug(
        `[SHARE-CLASS] Completed asset ${assetId} (${this.activeEnrichments.size} active, ${this.pendingQueue.length} pending)`,
      );
      this.processNextFromQueue();
    });

    this.activeEnrichments.set(assetId, enrichmentPromise);
    this.logger.debug(
      `[SHARE-CLASS] Started enrichment for ${assetId} (${this.activeEnrichments.size}/${this.maxConcurrentEnrichments} active)`,
    );
  }

  private processNextFromQueue(): void {
    if (
      this.pendingQueue.length === 0 ||
      this.activeEnrichments.size >= this.maxConcurrentEnrichments
    ) {
      return;
    }

    const nextAssetId = this.pendingQueue.shift();
    if (!nextAssetId) {
      return;
    }

    if (SHARE_CLASS_LOOKUP_GAP_MS > 0) {
      setTimeout(
        () => this.startEnrichment(nextAssetId),
        SHARE_CLASS_LOOKUP_GAP_MS,
      );
    } else {
      this.startEnrichment(nextAssetId);
    }
  }

  private async performEnrichment(assetId: string): Promise<void> {
    try {
      const asset = await this.assetsRepository.findById(assetId);
      if (!asset) {
        this.logger.warn(
          `[SHARE-CLASS] Asset ${assetId} not found, skipping enrichment`,
        );
        return;
      }

      if (!needsShareClassEnrichment(asset)) {
        this.logger.debug(
          `[SHARE-CLASS] Asset ${asset.morningstarId} already has an F ID, skipping`,
        );
        return;
      }

      this.logger.log(
        `[SHARE-CLASS] Looking up F ID for ${asset.morningstarId}`,
      );
      const identity =
        await this.shareClassLookup.lookupIdentityForAsset(asset);
      if (!identity.shareClassId && !(identity.isin && !asset.isin)) {
        this.logger.warn(
          `[SHARE-CLASS] Could not find F ID for ${asset.morningstarId}`,
        );
        return;
      }

      let updated = asset;
      if (identity.shareClassId) {
        const assigned = await this.assetsRepository.tryAssignShareClassId(
          asset.id,
          identity.shareClassId,
        );
        if (assigned) {
          updated = assigned;
          this.logger.log(
            `[SHARE-CLASS] Saved shareClassId ${identity.shareClassId} for ${asset.morningstarId}`,
          );
        } else {
          this.logger.debug(
            `[SHARE-CLASS] shareClassId ${identity.shareClassId} already owned; skipped persist for ${asset.morningstarId}`,
          );
        }
      }

      if (identity.isin && !updated.isin) {
        updated = await this.assetsRepository.updateIsin(
          updated.id,
          identity.isin,
        );
        this.logger.log(
          `[SHARE-CLASS] Saved ISIN ${identity.isin} for ${asset.morningstarId}`,
        );
      }

      await this.invalidateAssetCache({
        isin: updated.isin,
        morningstarId: updated.morningstarId,
        shareClassId: updated.shareClassId,
      });
    } catch (error) {
      this.logger.error(
        `[SHARE-CLASS] Error enriching share class for ${assetId}: ${getErrorMessage(error)}`,
      );
    }
  }

  private async invalidateAssetCache(options: {
    isin?: string | null;
    morningstarId?: string;
    shareClassId?: string | null;
  }): Promise<void> {
    const keys: string[] = [];
    if (options.isin) {
      keys.push(
        `${CACHE_CONFIG.ASSET_KEY_PREFIX}${options.isin.toUpperCase()}`,
      );
    }
    if (options.morningstarId) {
      keys.push(
        `${CACHE_CONFIG.ASSET_KEY_PREFIX}${options.morningstarId.toUpperCase()}`,
      );
    }
    if (options.shareClassId) {
      keys.push(
        `${CACHE_CONFIG.ASSET_KEY_PREFIX}${options.shareClassId.toUpperCase()}`,
      );
    }
    await Promise.all(keys.map((key) => this.cacheManager.del(key)));
  }
}
