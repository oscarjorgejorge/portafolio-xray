import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssetsRepository } from './assets.repository';
import * as cheerio from 'cheerio';
import { HttpClientService } from '../common/http';
import { createContextLogger } from '../common/logger';
import { getErrorMessage } from './resolver/utils/error-handler';
import { VALID_ISIN_PREFIXES } from './resolver/utils/constants';
import { IdentifierClassifier } from '../common/utils/identifier-classifier';
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

    // Search query targeting ISIN codes on high-signal domains
    // Broadened to include issuer and data providers (e.g. FT) to improve hit rate
    const searchQuery =
      `"${cleanName}" (ISIN OR "A2 USD" OR LU OR IE) ` +
      '(site:morningstar.com OR site:morningstar.es OR site:global.morningstar.com ' +
      'OR site:janushenderson.com OR site:markets.ft.com OR site:ft.com ' +
      'OR site:moneycontroller.it OR site:justetf.com)';

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

    // First try to extract ISIN directly from DuckDuckGo result snippets/links
    const { isin, candidateUrls } = this.extractIsinFromHtml(response.data);
    if (isin) {
      return isin;
    }

    // Fallback: follow a few high-signal result URLs and scan their HTML
    if (candidateUrls.length > 0) {
      const pageIsin = await this.searchIsinInResultPages(candidateUrls);
      if (pageIsin) {
        return pageIsin;
      }
    }

    return null;
  }

  /**
   * Extract valid ISIN candidates and result URLs from DuckDuckGo HTML
   */
  private extractIsinFromHtml(html: string): {
    isin: string | null;
    candidateUrls: string[];
  } {
    const $ = cheerio.load(html);

    // Extract text from results
    const resultsText =
      $('.result__body').text() + ' ' + $('.result__snippet').text();

    // Also inspect all result links (href) because many data providers
    // embed the ISIN directly in the URL, e.g.:
    // https://markets.ft.com/data/funds/tearsheet/summary?s=LU1897414303:USD
    const linksText = $('a')
      .map((_, el) => $(el).attr('href') || '')
      .get()
      .join(' ');

    const combinedText = `${resultsText} ${linksText}`;

    const isin = this.extractIsinFromText(combinedText);

    // Collect candidate result URLs (DuckDuckGo uses .result__a for result links)
    const candidateUrls: string[] = [];
    $('.result__a').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        candidateUrls.push(href);
      }
    });

    return { isin, candidateUrls };
  }

  /**
   * Follow result links and try to extract ISIN from the target pages.
   * This is slower, so we only check a small number of high-signal domains.
   */
  private async searchIsinInResultPages(
    urls: string[],
  ): Promise<string | null> {
    const MAX_PAGES = 3;
    const allowedDomains = [
      'morningstar.com',
      'global.morningstar.com',
      'morningstar.es',
      'janushenderson.com',
      'markets.ft.com',
      'ft.com',
      'moneycontroller.it',
      'justetf.com',
    ];

    const normalizeUrl = (rawUrl: string): string => {
      // DuckDuckGo sometimes wraps target URLs like "/l/?kh=-1&uddg=ENCODED"
      if (rawUrl.includes('/l/?') && rawUrl.includes('uddg=')) {
        try {
          const urlObj = new URL(rawUrl, 'https://duckduckgo.com');
          const encoded = urlObj.searchParams.get('uddg');
          if (encoded) {
            return decodeURIComponent(encoded);
          }
        } catch {
          return rawUrl;
        }
      }
      return rawUrl;
    };

    const isAllowedDomain = (urlStr: string): boolean => {
      try {
        const { hostname } = new URL(urlStr);
        return allowedDomains.some((domain) => hostname.endsWith(domain));
      } catch {
        return false;
      }
    };

    for (const rawUrl of urls.slice(0, MAX_PAGES)) {
      const targetUrl = normalizeUrl(rawUrl);
      if (!isAllowedDomain(targetUrl)) continue;

      try {
        this.logger.debug(`[ENRICH] Following result URL: ${targetUrl}`);
        const resp = await this.httpClient.get<string>(targetUrl, {
          responseType: 'html',
          timeout: this.enrichmentTimeoutMs,
        });
        if (!resp.ok || !resp.data) continue;

        const $ = cheerio.load(resp.data);
        const pageText = $('body').text();
        const isin = this.extractIsinFromText(pageText);
        if (isin) {
          this.logger.debug(
            `[ENRICH] Found ISIN ${isin} in result page: ${targetUrl}`,
          );
          return isin;
        }
      } catch (error) {
        this.logger.debug(
          `[ENRICH] Failed to fetch or parse result page ${targetUrl}: ${getErrorMessage(error)}`,
        );
      }
    }

    return null;
  }

  /**
   * Extract a valid ISIN from arbitrary text using prefix + checksum validation.
   */
  private extractIsinFromText(text: string): string | null {
    // Look for ISIN patterns (2 letter country code + 10 alphanumeric)
    const isinPattern = /\b([A-Z]{2}[A-Z0-9]{10})\b/g;
    const matches = text.match(isinPattern);

    if (!matches) {
      this.logger.debug(`[ENRICH] No ISIN patterns found in text`);
      return null;
    }

    // Filter to valid ISIN country codes AND valid checksum.
    const validIsins = matches
      .map((m) => m.toUpperCase())
      .filter((isin) => {
        const prefix = isin.substring(0, 2);
        if (
          !VALID_ISIN_PREFIXES.includes(
            prefix as (typeof VALID_ISIN_PREFIXES)[number],
          )
        ) {
          return false;
        }
        return IdentifierClassifier.validateISINChecksum(isin);
      });

    if (validIsins.length === 0) {
      this.logger.debug(
        `[ENRICH] No valid ISINs found (prefix+checksum) in matches`,
      );
      return null;
    }

    this.logger.debug(
      `[ENRICH] Found potential ISINs: ${validIsins.join(', ')}`,
    );
    return validIsins[0];
  }
}
