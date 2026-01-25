import { Injectable, Logger } from '@nestjs/common';
import { AssetsRepository } from './assets.repository';
import * as cheerio from 'cheerio';

/**
 * IsinEnrichmentService
 * Asynchronously enriches assets with their real ISIN by searching the web
 * Uses fire-and-forget pattern to not block the main response
 */
@Injectable()
export class IsinEnrichmentService {
  private readonly logger = new Logger(IsinEnrichmentService.name);

  constructor(private readonly assetsRepository: AssetsRepository) {}

  /**
   * Enrich ISIN in background (fire-and-forget)
   * Does not block - returns immediately
   */
  enrichIsinInBackground(assetId: string, fundName: string): void {
    // Use setImmediate to not block the event loop
    // Wrap async function to satisfy ESLint void return requirement
    setImmediate(() => {
      void this.performEnrichment(assetId, fundName);
    });
  }

  /**
   * Perform the actual ISIN enrichment
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
        `[ENRICH] Error enriching ISIN for ${assetId}: ${error}`,
      );
      // Mark as complete to avoid infinite retries
      try {
        await this.assetsRepository.markIsinEnrichmentComplete(assetId);
      } catch {
        // Ignore cleanup errors
      }
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

    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        this.logger.warn(`[ENRICH] DuckDuckGo returned ${response.status}`);
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract text from results
      const resultsText =
        $('.result__body').text() + ' ' + $('.result__snippet').text();

      // Look for ISIN patterns (2 letter country code + 10 alphanumeric)
      const isinPattern = /\b([A-Z]{2}[A-Z0-9]{10})\b/g;
      const matches = resultsText.match(isinPattern);

      if (matches) {
        // Filter to valid ISIN country codes (exclude Morningstar IDs like F00000...)
        const validPrefixes = [
          'LU',
          'IE',
          'DE',
          'FR',
          'GB',
          'NL',
          'CH',
          'AT',
          'ES',
          'IT',
          'BE',
          'SE',
          'NO',
          'DK',
          'FI',
        ];
        const validIsins = matches.filter((isin) => {
          const prefix = isin.substring(0, 2);
          return validPrefixes.includes(prefix);
        });

        if (validIsins.length > 0) {
          // Return the first valid ISIN found
          this.logger.debug(
            `[ENRICH] Found potential ISINs: ${validIsins.join(', ')}`,
          );
          return validIsins[0];
        }
      }

      this.logger.debug(`[ENRICH] No valid ISIN found in search results`);
      return null;
    } catch (error) {
      this.logger.warn(`[ENRICH] Search error: ${error}`);
      return null;
    }
  }
}
