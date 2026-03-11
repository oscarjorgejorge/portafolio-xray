import { Injectable } from '@nestjs/common';
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
import { createContextLogger } from '../../../common/logger';

/**
 * Strategy A: Morningstar.es API (Best source)
 * Searches using the official Morningstar.es SecuritySearch API
 */
@Injectable()
export class ApiSearchStrategy implements SearchStrategy {
  private readonly logger = createContextLogger(ApiSearchStrategy.name);
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
   *
   * Response format: "Name|{JSON}|Type|Ticker|Exchange|TypePlural\r\n"
   * Example: "CoinShares XBT...|{\"i\":\"0P0001AMV4\",...}|ETF|BITCOIN XBT|OSTO|ETFs\r\n"
   */
  private parseApiResponse(text: string): SearchResult[] {
    const results: SearchResult[] = [];

    // Split by newlines to process each result line
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    let parseFailures = 0;

    for (const line of lines) {
      // Parse the pipe-delimited format: Name|{JSON}|Type|Ticker|Exchange|TypePlural
      const parts = line.split('|');

      // Extract the type from the pipe-delimited format (3rd position, after JSON)
      // Find the JSON part and the type that follows
      let jsonStr: string | null = null;
      let pipeDelimitedType: string | null = null;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('{') && part.endsWith('}')) {
          jsonStr = part;
          // The type should be the next part
          if (i + 1 < parts.length) {
            pipeDelimitedType = parts[i + 1]?.trim() || null;
          }
          break;
        }
      }

      // Fallback: try regex to find JSON if not found in pipe format
      if (!jsonStr) {
        const jsonMatch = line.match(/\{[^{}]+\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      if (!jsonStr) {
        continue;
      }

      const item = safeJsonParse<MorningstarApiItem>(jsonStr);

      if (item) {
        // Pass the pipe-delimited type to help with asset type detection
        const parsed = this.parseApiItem(item, pipeDelimitedType);
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
   * @param item - The parsed JSON item from the API
   * @param pipeDelimitedType - Optional type extracted from pipe-delimited format (e.g., "ETF", "Fund", "Stock")
   */
  private parseApiItem(
    item: MorningstarApiItem,
    pipeDelimitedType?: string | null,
  ): SearchResult[] | null {
    const rawType = item.tt ?? item.Type ?? item.type;
    const securityType = item.t ?? item.tt ?? item.Type ?? 2;
    const isStock = securityType === 3 || securityType === '3';

    // IMPORTANT: Use multiple sources to detect asset type, in order of priority:
    // 1. Pipe-delimited type (most reliable, explicitly states "ETF", "Fund", etc.)
    // 2. Raw type code (CE/ET for ETF)
    // 3. Security type number (3 = stock)

    // Check pipe-delimited type first (case-insensitive)
    const normalizedPipeType = pipeDelimitedType?.toLowerCase().trim();
    const isETFFromPipe =
      normalizedPipeType === 'etf' || normalizedPipeType === 'etfs';
    const isStockFromPipe =
      normalizedPipeType === 'stock' ||
      normalizedPipeType === 'stocks' ||
      normalizedPipeType === 'equity';
    const isFundFromPipe =
      normalizedPipeType === 'fund' || normalizedPipeType === 'funds';

    // Check raw type code
    const isETFFromRawType = rawType === 'CE' || rawType === 'ET';

    // Determine final asset type
    let detectedAssetType: MorningstarAssetType;
    if (isETFFromPipe || isETFFromRawType) {
      detectedAssetType = MS_ASSET_TYPES.ETF;
    } else if (isStockFromPipe || isStock) {
      detectedAssetType = MS_ASSET_TYPES.STOCK;
    } else if (isFundFromPipe) {
      detectedAssetType = MS_ASSET_TYPES.FUND;
    } else {
      detectedAssetType = MS_ASSET_TYPES.FUND; // Default to fund
    }

    this.logger.debug(
      `[${this.name}] Detected asset type: ${detectedAssetType} (pipeType: ${pipeDelimitedType}, rawType: ${rawType}, securityType: ${securityType})`,
    );

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
