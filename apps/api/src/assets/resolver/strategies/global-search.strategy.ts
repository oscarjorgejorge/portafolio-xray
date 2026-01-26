import { Injectable, Logger } from '@nestjs/common';
import { SearchResult, GlobalMorningstarItem } from '../resolver.types';
import { SearchStrategy } from './search-strategy.interface';
import {
  buildGlobalSearchUrl,
  buildMorningstarUrl,
} from '../utils/url-builder';
import { HttpClientService } from '../../../common/http';

/**
 * Strategy C: Global Morningstar API (backup)
 * Searches using the global.morningstar.com API
 */
@Injectable()
export class GlobalSearchStrategy implements SearchStrategy {
  private readonly logger = new Logger(GlobalSearchStrategy.name);
  readonly name = 'GLOBAL';

  constructor(private readonly httpClient: HttpClientService) {}

  async search(query: string): Promise<SearchResult[]> {
    this.logger.debug(
      `[${this.name}] Searching global.morningstar.com for: ${query}`,
    );

    const endpoint = buildGlobalSearchUrl(query);

    const response = await this.httpClient.get<string>(endpoint, {
      responseType: 'text',
      timeout: 15000,
      headers: {
        Accept: 'application/json',
        Origin: 'https://global.morningstar.com',
        Referer: 'https://global.morningstar.com/',
      },
    });

    if (!response.ok || !response.data) {
      return [];
    }

    return this.parseApiResponse(response.data);
  }

  /**
   * Parse API response text into search results
   */
  private parseApiResponse(text: string): SearchResult[] {
    try {
      const data = JSON.parse(text) as GlobalMorningstarItem[];

      if (Array.isArray(data) && data.length > 0) {
        this.logger.debug(`[${this.name}] Found ${data.length} results`);
        return data.slice(0, 5).map((item: GlobalMorningstarItem) => ({
          url: buildMorningstarUrl(
            item.securityId ?? item.id ?? '',
            'Fondo', // Default to fund, will be corrected by main API
          ),
          title: item.name ?? item.legalName ?? '',
          snippet: `${item.isin ?? ''} | ${item.ticker ?? ''}`,
          morningstarId: item.securityId ?? item.id ?? null,
          domain: 'global.morningstar.com',
          ticker: item.ticker,
        }));
      }
    } catch {
      // Not valid JSON, return empty
      this.logger.debug(`[${this.name}] Invalid JSON response`);
    }

    return [];
  }
}
