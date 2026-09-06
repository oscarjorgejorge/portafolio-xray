import { Injectable } from '@nestjs/common';
import { SearchResult, GlobalMorningstarItem } from '../resolver.types';
import { SearchStrategy } from './search-strategy.interface';
import {
  buildGlobalSearchUrl,
  buildMorningstarUrl,
} from '../utils/url-builder';
import { safeJsonParse } from '../utils/error-handler';
import { HttpClientService } from '../../../common/http';
import { createContextLogger } from '../../../common/logger';
import { MS_ASSET_TYPES } from '../utils/constants';
import { IdentifierClassifier } from '../../../common/utils/identifier-classifier';

type SearchLocale = { languageId: string; countryId: string };

/**
 * Strategy C: Global Morningstar API (backup)
 * Searches using the global.morningstar.com API
 */
@Injectable()
export class GlobalSearchStrategy implements SearchStrategy {
  private readonly logger = createContextLogger(GlobalSearchStrategy.name);
  readonly name = 'GLOBAL';

  constructor(private readonly httpClient: HttpClientService) {}

  async search(query: string): Promise<SearchResult[]> {
    this.logger.debug(
      `[${this.name}] Searching global.morningstar.com for: ${query}`,
    );

    for (const locale of this.localesFor(query)) {
      const results = await this.searchLocale(query, locale);
      if (results.length > 0) {
        return results;
      }
    }

    return [];
  }

  private localesFor(query: string): SearchLocale[] {
    const locales: SearchLocale[] = [{ languageId: 'es-ES', countryId: 'ES' }];
    if (!IdentifierClassifier.isISIN(query)) {
      return locales;
    }

    const countryId = query.slice(0, 2).toUpperCase();
    if (countryId !== 'ES') {
      locales.push({ languageId: 'en-GB', countryId });
    }
    if (countryId !== 'GB') {
      locales.push({ languageId: 'en-GB', countryId: 'GB' });
    }
    return locales;
  }

  private async searchLocale(
    query: string,
    locale: SearchLocale,
  ): Promise<SearchResult[]> {
    const endpoint = buildGlobalSearchUrl(query, locale);
    const response = await this.httpClient.get<string>(endpoint, {
      responseType: 'text',
      timeout: 15000,
      headers: {
        Accept: 'application/json',
        Origin: 'https://global.morningstar.com',
        Referer:
          locale.countryId === 'ES'
            ? 'https://global.morningstar.com/'
            : 'https://global.morningstar.com/en-eu/',
      },
    });

    if (!response.ok || !response.data) {
      return [];
    }

    return this.parseApiResponse(response.data, locale.countryId !== 'ES');
  }

  /**
   * Parse API response text into search results
   * Uses safe JSON parsing with proper error logging
   */
  private parseApiResponse(
    text: string,
    preferEuQuote: boolean,
  ): SearchResult[] {
    const data = safeJsonParse<GlobalMorningstarItem[]>(
      text,
      this.logger,
      this.name,
    );

    if (!data) {
      this.logger.debug(`[${this.name}] Response is not valid JSON`);
      return [];
    }

    if (!Array.isArray(data)) {
      this.logger.debug(`[${this.name}] Response is not an array`);
      return [];
    }

    if (data.length === 0) {
      this.logger.debug(`[${this.name}] Empty response array`);
      return [];
    }

    this.logger.debug(`[${this.name}] Found ${data.length} results`);

    return data.slice(0, 5).map((item: GlobalMorningstarItem) => {
      const id = item.securityId ?? item.id ?? '';
      return {
        url: buildMorningstarUrl(
          id,
          MS_ASSET_TYPES.FUND,
          preferEuQuote ? 'eu' : undefined,
        ),
        title: item.name ?? item.legalName ?? '',
        snippet: `${item.isin ?? ''} | ${item.ticker ?? ''}`,
        morningstarId: item.securityId ?? item.id ?? null,
        domain: 'global.morningstar.com',
        ticker: item.ticker,
      };
    });
  }
}
