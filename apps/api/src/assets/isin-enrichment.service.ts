import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssetsRepository } from './assets.repository';
import * as cheerio from 'cheerio';
import { HttpClientService } from '../common/http';
import { createContextLogger } from '../common/logger';
import { getErrorMessage } from './resolver/utils/error-handler';
import { VALID_ISIN_PREFIXES } from './resolver/utils/constants';
import { IIsinEnrichmentService } from './interfaces';
import type { AppConfig } from '../config';

/**
 * Enrichment task waiting in the pending queue
 */
interface PendingEnrichment {
  assetId: string;
  fundName: string;
}

/**
 * IsinEnrichmentService
 * Asynchronously enriches assets with their real ISIN by searching the web
 * Uses fire-and-forget pattern to not block the main response
 *
 * Features:
 * - Deduplication: Prevents multiple enrichments for the same asset running concurrently
 * - Concurrency limit: Prevents overwhelming external APIs with too many parallel requests
 * - Queue management: Pending tasks are queued and processed when slots become available
 * - Graceful cleanup: Ensures tracking map is cleaned up even on errors
 */
@Injectable()
export class IsinEnrichmentService implements IIsinEnrichmentService {
  private readonly logger = createContextLogger(IsinEnrichmentService.name);
  private readonly maxConcurrentEnrichments: number;
  private readonly enrichmentTimeoutMs: number;

  /**
   * Track enrichments currently in progress to prevent duplicate concurrent operations
   * Key: assetId, Value: Promise of the enrichment operation
   */
  private readonly activeEnrichments = new Map<string, Promise<void>>();

  /**
   * Queue of pending enrichment tasks waiting for a free slot
   */
  private readonly pendingQueue: PendingEnrichment[] = [];

  /**
   * Set of asset IDs that are either active or pending (for fast deduplication)
   */
  private readonly trackedAssets = new Set<string>();

  constructor(
    private readonly assetsRepository: AssetsRepository,
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    const resolutionConfig = this.configService.get('resolution', {
      infer: true,
    });
    this.maxConcurrentEnrichments = resolutionConfig.isinEnrichmentConcurrency;
    this.enrichmentTimeoutMs = resolutionConfig.isinEnrichmentTimeoutMs;
  }

  /**
   * Enrich ISIN in background (fire-and-forget)
   * Does not block - returns immediately
   * Respects concurrency limit and queues excess requests
   * Prevents duplicate enrichments for the same asset
   */
  enrichIsinInBackground(assetId: string, fundName: string): void {
    // Check if enrichment is already tracked (active or pending)
    if (this.trackedAssets.has(assetId)) {
      this.logger.debug(
        `[ENRICH] Enrichment already tracked for asset ${assetId}, skipping duplicate request`,
      );
      return;
    }

    // Track this asset
    this.trackedAssets.add(assetId);

    // Check if we can start immediately or need to queue
    if (this.activeEnrichments.size < this.maxConcurrentEnrichments) {
      this.startEnrichment(assetId, fundName);
    } else {
      // Add to pending queue
      this.pendingQueue.push({ assetId, fundName });
      this.logger.debug(
        `[ENRICH] Queue full (${this.activeEnrichments.size}/${this.maxConcurrentEnrichments}), ` +
          `asset ${assetId} added to pending queue (${this.pendingQueue.length} pending)`,
      );
    }
  }

  /**
   * Start an enrichment operation (internal method)
   */
  private startEnrichment(assetId: string, fundName: string): void {
    const enrichmentPromise = this.performEnrichment(assetId, fundName).finally(
      () => {
        // Clean up active enrichment
        this.activeEnrichments.delete(assetId);
        this.trackedAssets.delete(assetId);

        this.logger.debug(
          `[ENRICH] Completed asset ${assetId} (${this.activeEnrichments.size} active, ${this.pendingQueue.length} pending)`,
        );

        // Process next item from queue if available
        this.processNextFromQueue();
      },
    );

    this.activeEnrichments.set(assetId, enrichmentPromise);
    this.logger.debug(
      `[ENRICH] Started enrichment for ${assetId} (${this.activeEnrichments.size}/${this.maxConcurrentEnrichments} active)`,
    );
  }

  /**
   * Process the next item from the pending queue
   */
  private processNextFromQueue(): void {
    if (
      this.pendingQueue.length > 0 &&
      this.activeEnrichments.size < this.maxConcurrentEnrichments
    ) {
      const next = this.pendingQueue.shift();
      if (next) {
        this.logger.debug(
          `[ENRICH] Processing queued enrichment for ${next.assetId} (${this.pendingQueue.length} remaining in queue)`,
        );
        this.startEnrichment(next.assetId, next.fundName);
      }
    }
  }

  /**
   * Check if an enrichment is currently active or pending for a given asset
   * Useful for debugging and testing
   */
  isEnrichmentInProgress(assetId: string): boolean {
    return this.trackedAssets.has(assetId);
  }

  /**
   * Check if an enrichment is currently active (not just pending)
   */
  isEnrichmentActive(assetId: string): boolean {
    return this.activeEnrichments.has(assetId);
  }

  /**
   * Get the number of enrichments currently active
   * Useful for monitoring and debugging
   */
  getActiveEnrichmentCount(): number {
    return this.activeEnrichments.size;
  }

  /**
   * Get the number of enrichments waiting in the queue
   */
  getPendingEnrichmentCount(): number {
    return this.pendingQueue.length;
  }

  /**
   * Get total tracked enrichments (active + pending)
   */
  getTotalTrackedCount(): number {
    return this.trackedAssets.size;
  }

  /**
   * Get the maximum concurrent enrichments limit
   */
  getMaxConcurrentLimit(): number {
    return this.maxConcurrentEnrichments;
  }

  /**
   * Perform the actual ISIN enrichment
   * Handles all errors gracefully and ensures enrichment is marked complete
   */
  private async performEnrichment(
    assetId: string,
    fundName: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `[ENRICH] Starting ISIN enrichment for asset ${assetId}: "${fundName}"`,
      );

      const isin = await this.searchIsinByFundName(fundName);

      if (isin) {
        await this.assetsRepository.updateIsin(assetId, isin);
        this.logger.log(
          `[ENRICH] Successfully enriched ISIN for ${assetId}: ${isin}`,
        );
      } else {
        // Mark as no longer pending even if we couldn't find the ISIN
        await this.assetsRepository.markIsinEnrichmentComplete(assetId);
        this.logger.warn(
          `[ENRICH] Could not find ISIN for asset ${assetId}: "${fundName}"`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[ENRICH] Error enriching ISIN for ${assetId}: ${getErrorMessage(error)}`,
      );
      // Mark as complete to avoid infinite retries
      await this.safeMarkComplete(assetId);
    }
  }

  /**
   * Safely mark enrichment as complete, logging any cleanup errors
   */
  private async safeMarkComplete(assetId: string): Promise<void> {
    try {
      await this.assetsRepository.markIsinEnrichmentComplete(assetId);
    } catch (cleanupError) {
      this.logger.warn(
        `[ENRICH] Failed to mark enrichment complete for ${assetId}: ${getErrorMessage(cleanupError)}`,
      );
    }
  }

  /**
   * Search for ISIN using DuckDuckGo with the fund name
   */
  private async searchIsinByFundName(fundName: string): Promise<string | null> {
    // Clean up fund name for search
    const cleanName = fundName.replace(/\s+/g, ' ').trim();

    // Search query targeting ISIN codes (LU, IE, etc.)
    const searchQuery = `"${cleanName}" ISIN LU OR IE site:morningstar OR site:moneycontroller OR site:justetf`;

    this.logger.debug(`[ENRICH] Searching: ${searchQuery}`);

    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

    const response = await this.httpClient.get<string>(searchUrl, {
      responseType: 'html',
      timeout: this.enrichmentTimeoutMs,
    });

    if (!response.ok || !response.data) {
      this.logger.warn(`[ENRICH] DuckDuckGo returned ${response.status}`);
      return null;
    }

    return this.extractIsinFromHtml(response.data);
  }

  /**
   * Extract valid ISIN from HTML content
   */
  private extractIsinFromHtml(html: string): string | null {
    const $ = cheerio.load(html);

    // Extract text from results
    const resultsText =
      $('.result__body').text() + ' ' + $('.result__snippet').text();

    // Look for ISIN patterns (2 letter country code + 10 alphanumeric)
    const isinPattern = /\b([A-Z]{2}[A-Z0-9]{10})\b/g;
    const matches = resultsText.match(isinPattern);

    if (!matches) {
      this.logger.debug(`[ENRICH] No ISIN patterns found in search results`);
      return null;
    }

    // Filter to valid ISIN country codes (exclude Morningstar IDs like F00000...)
    const validIsins = matches.filter((isin) => {
      const prefix = isin.substring(0, 2);
      return VALID_ISIN_PREFIXES.includes(
        prefix as (typeof VALID_ISIN_PREFIXES)[number],
      );
    });

    if (validIsins.length === 0) {
      this.logger.debug(`[ENRICH] No valid ISIN prefixes found in matches`);
      return null;
    }

    // Return the first valid ISIN found
    this.logger.debug(
      `[ENRICH] Found potential ISINs: ${validIsins.join(', ')}`,
    );
    return validIsins[0];
  }
}
