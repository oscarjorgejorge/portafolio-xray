import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SearchResult } from '../resolver.types';
import { SearchStrategy } from './search-strategy.interface';
import { buildDuckDuckGoUrl } from '../utils/url-builder';
import { extractMorningstarId, extractDomain } from '../utils/id-extractor';
import { HttpClientService } from '../../../common/http';

/**
 * Strategy D: DuckDuckGo (fallback)
 * Searches Spanish and English paths for funds, ETFs, and stocks
 */
@Injectable()
export class DuckDuckGoStrategy implements SearchStrategy {
  private readonly logger = new Logger(DuckDuckGoStrategy.name);
  readonly name = 'DDG';

  constructor(private readonly httpClient: HttpClientService) {}

  /**
   * Search queries for different asset types and languages
   */
  private readonly SEARCH_PATTERNS = [
    'site:global.morningstar.com/*/inversiones/fondos',
    'site:global.morningstar.com/*/inversiones/etfs',
    'site:global.morningstar.com/*/inversiones/acciones',
    'site:global.morningstar.com/*/investments/funds',
    'site:global.morningstar.com/*/investments/etfs',
    'site:global.morningstar.com/*/investments/stocks',
  ];

  async search(query: string): Promise<SearchResult[]> {
    this.logger.debug(`[${this.name}] Searching DuckDuckGo for: ${query}`);

    // Execute all searches in parallel for better performance
    const searchPromises = this.SEARCH_PATTERNS.map((pattern) =>
      this.searchSingle(`${pattern} "${query}"`),
    );

    const results = await Promise.all(searchPromises);
    const allResults = results.flat();

    // Deduplicate by Morningstar ID
    return this.deduplicateResults(allResults);
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
      timeout: 10000,
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

    if (results.length > 0) {
      this.logger.debug(`[${this.name}] Found ${results.length} results`);
    }

    return results;
  }
}
