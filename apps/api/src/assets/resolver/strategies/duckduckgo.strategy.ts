import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SearchResult } from '../resolver.types';
import { SearchStrategy } from './search-strategy.interface';
import { buildDuckDuckGoUrl } from '../utils/url-builder';
import { extractMorningstarId, extractDomain } from '../utils/id-extractor';
import { HttpClientService } from '../../../common/http';
import { createContextLogger } from '../../../common/logger';

/** Maximum concurrent requests to avoid rate limiting */
const MAX_CONCURRENCY = 3;

/** Minimum results needed before early exit */
const MIN_RESULTS_FOR_EARLY_EXIT = 5;

/** Delay between batches to avoid rate limiting (ms) */
const BATCH_DELAY = 100;

/**
 * Strategy D: DuckDuckGo (fallback)
 * Searches Spanish and English paths for funds, ETFs, and stocks
 * Optimized with concurrency control and early exit for better performance
 */
@Injectable()
export class DuckDuckGoStrategy implements SearchStrategy {
  private readonly logger = createContextLogger(DuckDuckGoStrategy.name);
  readonly name = 'DDG';

  constructor(private readonly httpClient: HttpClientService) {}

  /**
   * Search patterns ordered by priority (Spanish first, then English)
   * Grouped by asset type for batch processing
   */
  private readonly SEARCH_PATTERN_BATCHES = [
    // Batch 1: Spanish patterns (highest priority for ES locale)
    [
      'site:global.morningstar.com/*/inversiones/fondos',
      'site:global.morningstar.com/*/inversiones/etfs',
      'site:global.morningstar.com/*/inversiones/acciones',
    ],
    // Batch 2: English patterns (fallback)
    [
      'site:global.morningstar.com/*/investments/funds',
      'site:global.morningstar.com/*/investments/etfs',
      'site:global.morningstar.com/*/investments/stocks',
    ],
  ];

  async search(query: string): Promise<SearchResult[]> {
    this.logger.debug(`[${this.name}] Searching DuckDuckGo for: ${query}`);

    const allResults: SearchResult[] = [];

    // Process batches with early exit optimization
    for (const batch of this.SEARCH_PATTERN_BATCHES) {
      const batchResults = await this.searchBatchWithConcurrency(batch, query);
      allResults.push(...batchResults);

      // Early exit if we have enough results
      if (allResults.length >= MIN_RESULTS_FOR_EARLY_EXIT) {
        this.logger.debug(
          `[${this.name}] Early exit: found ${allResults.length} results`,
        );
        break;
      }

      // Small delay between batches to be respectful to DuckDuckGo
      if (batch !== this.SEARCH_PATTERN_BATCHES.at(-1)) {
        await this.delay(BATCH_DELAY);
      }
    }

    // Deduplicate by Morningstar ID
    const uniqueResults = this.deduplicateResults(allResults);

    this.logger.debug(
      `[${this.name}] Total unique results: ${uniqueResults.length}`,
    );

    return uniqueResults;
  }

  /**
   * Execute a batch of searches with concurrency control
   * Uses Promise.allSettled for resilience against partial failures
   */
  private async searchBatchWithConcurrency(
    patterns: string[],
    query: string,
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Process in chunks respecting MAX_CONCURRENCY
    for (let i = 0; i < patterns.length; i += MAX_CONCURRENCY) {
      const chunk = patterns.slice(i, i + MAX_CONCURRENCY);

      const searchPromises = chunk.map((pattern) =>
        this.searchSingle(`${pattern} "${query}"`),
      );

      // Use allSettled to handle individual failures gracefully
      const settledResults = await Promise.allSettled(searchPromises);

      for (const result of settledResults) {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          this.logger.debug(`[${this.name}] Search failed: ${result.reason}`);
        }
      }
    }

    return results;
  }

  /**
   * Deduplicate results by Morningstar ID
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      if (!r.morningstarId) return true;
      if (seen.has(r.morningstarId)) return false;
      seen.add(r.morningstarId);
      return true;
    });
  }

  /**
   * Execute a single DuckDuckGo search
   */
  private async searchSingle(searchQuery: string): Promise<SearchResult[]> {
    const searchUrl = buildDuckDuckGoUrl(searchQuery);

    const response = await this.httpClient.get<string>(searchUrl, {
      responseType: 'html',
      timeout: 8000, // Reduced timeout for faster fallback
    });

    if (!response.ok || !response.data) {
      return [];
    }

    return this.parseHtmlResponse(response.data);
  }

  /**
   * Parse DuckDuckGo HTML response and extract Morningstar results
   */
  private parseHtmlResponse(html: string): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('.result').each((_, element) => {
      const $el = $(element);
      const $link = $el.find('.result__a');
      const $snippet = $el.find('.result__snippet');

      let url = $link.attr('href') || '';
      const title = $link.text().trim();
      const snippet = $snippet.text().trim();

      // Extract actual URL from DuckDuckGo redirect
      if (url.includes('uddg=')) {
        const match = url.match(/uddg=([^&]+)/);
        if (match) url = decodeURIComponent(match[1]);
      }

      // Only include Morningstar results (exclude doc.morningstar)
      if (url.includes('morningstar') && !url.includes('doc.morningstar')) {
        const id = extractMorningstarId(url);
        results.push({
          url,
          title,
          snippet,
          morningstarId: id,
          domain: extractDomain(url),
        });
      }
    });

    return results;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
