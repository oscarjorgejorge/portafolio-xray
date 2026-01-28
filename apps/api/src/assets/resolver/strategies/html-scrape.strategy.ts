import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SearchResult } from '../resolver.types';
import { SearchStrategy } from './search-strategy.interface';
import { buildHtmlSearchUrl } from '../utils/url-builder';
import { extractMorningstarId, extractDomain } from '../utils/id-extractor';
import { HttpClientService } from '../../../common/http';
import { createContextLogger } from '../../../common/logger';

/**
 * Strategy B: HTML scraping from morningstar.es search page
 * Scrapes search results from the Morningstar.es web interface
 */
@Injectable()
export class HtmlScrapeStrategy implements SearchStrategy {
  private readonly logger = createContextLogger(HtmlScrapeStrategy.name);
  readonly name = 'HTML';

  constructor(private readonly httpClient: HttpClientService) {}

  async search(query: string): Promise<SearchResult[]> {
    this.logger.debug(`[${this.name}] Scraping search page for: ${query}`);

    const searchUrl = buildHtmlSearchUrl(query);

    const response = await this.httpClient.get<string>(searchUrl, {
      responseType: 'html',
      timeout: 15000,
    });

    if (!response.ok || !response.data) {
      return [];
    }

    return this.parseHtmlResponse(response.data);
  }

  /**
   * Parse HTML response and extract search results
   */
  private parseHtmlResponse(html: string): SearchResult[] {
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(
      'a[href*="id="], a[href*="/funds/"], a[href*="/fondos/"], a[href*="/etf/"]',
    ).each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (href && text) {
        const id = extractMorningstarId(href);
        if (id) {
          const fullUrl = href.startsWith('http')
            ? href
            : `https://www.morningstar.es${href}`;
          results.push({
            url: fullUrl,
            title: text,
            snippet: '',
            morningstarId: id,
            domain: extractDomain(fullUrl),
          });
        }
      }
    });

    if (results.length > 0) {
      this.logger.debug(`[${this.name}] Found ${results.length} results`);
    }

    return results.slice(0, 5);
  }
}
