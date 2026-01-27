import { Injectable, Logger } from '@nestjs/common';
import { SearchResult, MorningstarApiItem } from '../resolver.types';
import { SearchStrategy } from './search-strategy.interface';
import {
  MORNINGSTAR_TYPE_MAP,
  MS_ASSET_TYPES,
  MorningstarAssetType,
} from '../utils/constants';
import { buildApiSearchUrl, buildMorningstarUrl } from '../utils/url-builder';
import { isValidIsin } from '../utils/id-extractor';
import { safeJsonParse } from '../utils/error-handler';
import { HttpClientService } from '../../../common/http';

/**
 * Strategy A: Morningstar.es API (Best source)
 * Searches using the official Morningstar.es SecuritySearch API
 */
@Injectable()
export class ApiSearchStrategy implements SearchStrategy {
  private readonly logger = new Logger(ApiSearchStrategy.name);
  readonly name = 'API';

  constructor(private readonly httpClient: HttpClientService) {}

  async search(query: string): Promise<SearchResult[]> {
    this.logger.debug(`[${this.name}] Searching Morningstar API for: ${query}`);

    const endpoint = buildApiSearchUrl(query);

    const response = await this.httpClient.get<string>(endpoint, {
      responseType: 'text',
      timeout: 15000,
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://www.morningstar.es/',
      },
    });

    if (!response.ok || !response.data) {
      return [];
    }

    return this.parseApiResponse(response.data);
  }

  /**
   * Parse API response text into search results
   * Uses safe JSON parsing with proper error handling
   */
  private parseApiResponse(text: string): SearchResult[] {
    const results: SearchResult[] = [];
    const jsonMatches = text.match(/\{[^{}]+\}/g);

    if (!jsonMatches) {
      this.logger.debug(`[${this.name}] No JSON objects found in response`);
      return results;
    }

    let parseFailures = 0;

    for (const jsonStr of jsonMatches) {
      const item = safeJsonParse<MorningstarApiItem>(jsonStr);

      if (item) {
        const parsed = this.parseApiItem(item);
        if (parsed) {
          results.push(...parsed);
        }
      } else {
        parseFailures++;
      }
    }

    if (parseFailures > 0) {
      this.logger.debug(
        `[${this.name}] Skipped ${parseFailures} invalid JSON fragments`,
      );
    }

    if (results.length > 0) {
      this.logger.debug(`[${this.name}] Found ${results.length} results`);
    }

    return results;
  }

  /**
   * Parse a Morningstar API item into search results
   */
  private parseApiItem(item: MorningstarApiItem): SearchResult[] | null {
    const rawType = item.tt ?? item.Type ?? item.type;
    const securityType = item.t ?? item.tt ?? item.Type ?? 2;
    const isStock = securityType === 3 || securityType === '3';

    // IMPORTANT: Prioritize rawType (CE/ET) for ETF detection
    // Some ETPs/ETFs may have securityType=3 (stock) because they trade on exchanges
    // but rawType correctly identifies them as CE (Collective Investment/ETF)
    const isETF = rawType === 'CE' || rawType === 'ET';
    const detectedAssetType: MorningstarAssetType = isETF
      ? MS_ASSET_TYPES.ETF
      : isStock
        ? MS_ASSET_TYPES.STOCK
        : MS_ASSET_TYPES.FUND;

    // Get IDs based on asset type
    const { principalId, secondaryId } = this.extractIds(item, isStock);

    if (!principalId) return null;

    const tickerString = item.ticker;
    // Validate ISIN from API - only use if it's a valid ISIN format
    const rawIsinString = item.isin;
    const isinString =
      rawIsinString && isValidIsin(rawIsinString)
        ? rawIsinString.toUpperCase()
        : undefined;

    const results: SearchResult[] = [];

    // Add primary result
    results.push({
      url: buildMorningstarUrl(principalId, detectedAssetType),
      title: item.n ?? '',
      snippet: `ID Principal: ${principalId} | Tipo: ${detectedAssetType}${isinString ? ` | ISIN: ${isinString}` : ''}`,
      morningstarId: principalId,
      domain: 'global.morningstar.com',
      ticker: tickerString,
      isin: isinString,
      assetType: detectedAssetType,
      rawType: rawType,
    });

    // Add secondary ID if different
    if (secondaryId && secondaryId !== principalId) {
      results.push({
        url: buildMorningstarUrl(secondaryId, detectedAssetType),
        title: item.n ?? '',
        snippet: `ID Secundario: ${secondaryId} | Tipo: ${detectedAssetType}${isinString ? ` | ISIN: ${isinString}` : ''}`,
        morningstarId: secondaryId,
        domain: 'global.morningstar.com',
        ticker: tickerString,
        isin: isinString,
        assetType: detectedAssetType,
        rawType: rawType,
      });
    }

    return results;
  }

  /**
   * Extract primary and secondary IDs from API item
   * For stocks, use standard priority (pi first)
   * For funds, prioritize IDs starting with "F"
   */
  private extractIds(
    item: MorningstarApiItem,
    isStock: boolean,
  ): { principalId: string | null; secondaryId: string | null } {
    if (isStock) {
      // For stocks, use standard priority
      const principalId = item.pi ?? item.i ?? null;
      const secondaryId = item.i && item.i !== principalId ? item.i : null;
      return { principalId, secondaryId };
    }

    // For funds, prioritize IDs starting with "F"
    const piId = item.pi ?? null;
    const iId = item.i ?? null;

    const piStartsWithF = piId?.toUpperCase().startsWith('F') ?? false;
    const iStartsWithF = iId?.toUpperCase().startsWith('F') ?? false;

    if (piStartsWithF || iStartsWithF) {
      // Prefer the one starting with "F"
      const principalId = piStartsWithF ? piId : iId;
      const secondaryId = piStartsWithF
        ? iId && iId !== principalId
          ? iId
          : null
        : piId && piId !== principalId
          ? piId
          : null;
      return { principalId, secondaryId };
    }

    // If neither starts with "F", use standard priority
    const principalId = piId ?? iId ?? null;
    const secondaryId = iId && iId !== principalId ? iId : null;
    return { principalId, secondaryId };
  }

  /**
   * Map raw type code to asset type
   */
  private mapMorningstarType(
    rawType: string | undefined,
  ): MorningstarAssetType {
    if (!rawType) return MS_ASSET_TYPES.UNKNOWN;
    const upperType = rawType.toUpperCase();
    return MORNINGSTAR_TYPE_MAP[upperType] || MS_ASSET_TYPES.UNKNOWN;
  }
}
