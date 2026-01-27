import { Injectable, Logger } from '@nestjs/common';
import { AssetsRepository } from './assets.repository';
import * as cheerio from 'cheerio';
import { HttpClientService } from '../common/http';
import { getErrorMessage } from './resolver/utils/error-handler';
import { VALID_ISIN_PREFIXES } from './resolver/utils/constants';
import { IIsinEnrichmentService } from './interfaces';

/**
 * IsinEnrichmentService
 * Asynchronously enriches assets with their real ISIN by searching the web
 * Uses fire-and-forget pattern to not block the main response
 *
 * Features:
 * - Deduplication: Prevents multiple enrichments for the same asset running concurrently
 * - Graceful cleanup: Ensures tracking map is cleaned up even on errors
 */
@Injectable()
export class IsinEnrichmentService implements IIsinEnrichmentService {
  private readonly logger = new Logger(IsinEnrichmentService.name);

  /**
   * Track enrichments currently in progress to prevent duplicate concurrent operations
   * Key: assetId, Value: Promise of the enrichment operation
   */
  private readonly enrichmentQueue = new Map<string, Promise<void>>();

  constructor(
    private readonly assetsRepository: AssetsRepository,
    private readonly httpClient: HttpClientService,
  ) {}

  /**
   * Enrich ISIN in background (fire-and-forget)
   * Does not block - returns immediately
   * Prevents duplicate enrichments for the same asset
   */
  enrichIsinInBackground(assetId: string, fundName: string): void {
    // Check if enrichment is already in progress for this asset
    if (this.enrichmentQueue.has(assetId)) {
      this.logger.debug(
        `[ENRICH] Enrichment already in progress for asset ${assetId}, skipping duplicate request`,
      );
      return;
    }

    // Create the enrichment promise and track it
    const enrichmentPromise = this.performEnrichment(assetId, fundName).finally(
      () => {
        // Always clean up the queue entry when done (success or failure)
        this.enrichmentQueue.delete(assetId);
        this.logger.debug(
          `[ENRICH] Removed asset ${assetId} from enrichment queue (${this.enrichmentQueue.size} remaining)`,
        );
      },
    );

    // Add to tracking map
    this.enrichmentQueue.set(assetId, enrichmentPromise);
    this.logger.debug(
      `[ENRICH] Added asset ${assetId} to enrichment queue (${this.enrichmentQueue.size} total)`,
    );
  }

  /**
   * Check if an enrichment is currently in progress for a given asset
   * Useful for debugging and testing
   */
  isEnrichmentInProgress(assetId: string): boolean {
    return this.enrichmentQueue.has(assetId);
  }

  /**
   * Get the number of enrichments currently in progress
   * Useful for monitoring and debugging
   */
  getActiveEnrichmentCount(): number {
    return this.enrichmentQueue.size;
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
      timeout: 15000,
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
