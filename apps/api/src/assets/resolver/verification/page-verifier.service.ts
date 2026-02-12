import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { VerificationResult } from '../resolver.types';
import {
  EUROPEAN_MARKETS,
  MS_ASSET_TYPES,
  MorningstarAssetType,
} from '../utils/constants';
import { buildMorningstarUrl } from '../utils/url-builder';
import { HttpClientService } from '../../../common/http';
import { createContextLogger } from '../../../common/logger';
import { IdentifierClassifier } from '../../../common/utils/identifier-classifier';

/**
 * Verification result with additional market/type information
 */
export interface ExtendedVerificationResult {
  verification: VerificationResult;
  workingUrl: string;
  marketId?: string;
  detectedAssetType?: MorningstarAssetType;
}

/**
 * URL path patterns for detecting asset types
 */
const ASSET_TYPE_URL_PATTERNS: Record<string, MorningstarAssetType> = {
  '/etfs/': MS_ASSET_TYPES.ETF,
  '/inversiones/etfs/': MS_ASSET_TYPES.ETF,
  '/investments/etfs/': MS_ASSET_TYPES.ETF,
  '/fondos/': MS_ASSET_TYPES.FUND,
  '/funds/': MS_ASSET_TYPES.FUND,
  '/inversiones/fondos/': MS_ASSET_TYPES.FUND,
  '/investments/funds/': MS_ASSET_TYPES.FUND,
  '/acciones/': MS_ASSET_TYPES.STOCK,
  '/stocks/': MS_ASSET_TYPES.STOCK,
  '/inversiones/acciones/': MS_ASSET_TYPES.STOCK,
  '/investments/stocks/': MS_ASSET_TYPES.STOCK,
};

/**
 * Service responsible for verifying Morningstar pages and extracting data
 */
@Injectable()
export class PageVerifierService {
  private readonly logger = createContextLogger(PageVerifierService.name);

  constructor(private readonly httpClient: HttpClientService) {}

  /**
   * Check if a page shows "not available in this market" message
   */
  private isMarketNotAvailable($: cheerio.CheerioAPI): boolean {
    const bodyText = $('body').text().toLowerCase();
    const notAvailablePatterns = [
      'no está disponible en el mercado',
      'not available in the market',
      'not available in this market',
      'título no está disponible',
      'title is not available',
      'elija uno de los mercados',
      'choose one of the markets',
      'select a different market',
    ];
    return notAvailablePatterns.some((pattern) => bodyText.includes(pattern));
  }

  /**
   * Verify a fund page and extract ISIN, name, and additional info
   */
  async verifyFundPage(
    url: string,
    expectedIsin: string,
  ): Promise<VerificationResult> {
    this.logger.debug(`[VERIFY] Verifying page: ${url}`);

    const result: VerificationResult = {
      verified: false,
      isinFound: null,
      nameFound: null,
      additionalInfo: {},
    };

    const response = await this.httpClient.get<string>(url, {
      responseType: 'html',
      timeout: 15000,
    });

    if (!response.ok) {
      this.logger.warn(`[VERIFY] HTTP ${response.status}`);
      // Treat non-200 responses (especially 404) as "not available in this market"
      if (response.status === 404) {
        result.additionalInfo.marketNotAvailable = 'true';
        result.additionalInfo.httpStatus = response.status.toString();
      }
      return result;
    }

    if (!response.data) {
      return result;
    }

    const html = response.data;
    const $ = cheerio.load(html);

    // Check if the fund is not available in this market
    if (this.isMarketNotAvailable($)) {
      this.logger.debug(`[VERIFY] Fund not available in this market`);
      result.additionalInfo.marketNotAvailable = 'true';
      return result;
    }

    // Extract ISINs
    const foundIsins = this.extractIsins($);
    this.logger.debug(
      `[VERIFY] Found ${foundIsins.length} potential ISINs: ${foundIsins.join(', ') || 'none'}`,
    );

    // Use the first valid ISIN found
    if (foundIsins.length > 0) {
      result.isinFound = foundIsins[0];

      if (expectedIsin && result.isinFound === expectedIsin.toUpperCase()) {
        result.verified = true;
        this.logger.log(`[VERIFY] ISIN confirmed: ${result.isinFound}`);
      } else if (result.isinFound) {
        this.logger.log(`[VERIFY] ISIN extracted: ${result.isinFound}`);
      }
    }

    // Extract fund name
    result.nameFound = this.extractName($);

    // Extract additional info (ticker, category, currency)
    this.extractAdditionalInfo($, url, result);

    if (!result.verified && result.isinFound) {
      this.logger.warn(
        `[VERIFY] ISIN found (${result.isinFound}) doesn't match expected (${expectedIsin})`,
      );
    }

    return result;
  }

  /**
   * Extract ISINs from page content
   */
  private extractIsins($: cheerio.CheerioAPI): string[] {
    const foundIsins: string[] = [];

    // Strategy 1: Check meta tags (most reliable for SSR pages)
    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const metaContent = `${metaKeywords} ${metaDescription}`;

    this.logger.debug(
      `[VERIFY] Meta keywords: ${metaKeywords.substring(0, 100)}...`,
    );

    // Strategy 2: Check title and h1
    const pageTitle = $('title').text() || '';
    const h1Text = $('h1').first().text() || '';

    // Strategy 3: Check body text
    const pageText = $('body').text();

    // Combined text to search (prioritize meta tags)
    const allTextSources = [metaContent, pageTitle, h1Text, pageText];

    // ISIN pattern: 2 letter country code + 10 alphanumeric
    const isinPattern = /\b([A-Z]{2}[A-Z0-9]{10})\b/gi;

    for (const textSource of allTextSources) {
      const matches = textSource.match(isinPattern);
      if (matches) {
        for (const match of matches) {
          const candidate = match.toUpperCase();
          // Use strict checksum validation to filter out garbage like "CANADAFRENCH"
          // which passes format check but fails ISO 6166 Luhn algorithm
          if (
            IdentifierClassifier.validateISINChecksum(candidate) &&
            !foundIsins.includes(candidate)
          ) {
            foundIsins.push(candidate);
            this.logger.debug(
              `[VERIFY] Found valid ISIN (checksum OK): ${candidate}`,
            );
          }
        }
      }
      // If we found ISINs in meta tags, prioritize those and stop
      if (foundIsins.length > 0 && textSource === metaContent) {
        this.logger.debug(`[VERIFY] Using ISIN from meta tags`);
        break;
      }
    }

    return foundIsins;
  }

  /**
   * Extract fund name from page
   */
  private extractName($: cheerio.CheerioAPI): string | null {
    const nameSelectors = [
      'h1',
      '.security-name',
      '[data-testid="security-name"]',
      '.fund-name',
      'title',
    ];

    for (const selector of nameSelectors) {
      const name = $(selector).first().text().trim();
      if (name && name.length > 3 && name.length < 200) {
        return name.replace(/\s+/g, ' ').trim();
      }
    }

    return null;
  }

  /**
   * Detect asset type from URL by checking path patterns
   */
  private detectAssetTypeFromUrl(url: string): MorningstarAssetType | null {
    const normalizedUrl = url.toLowerCase();

    for (const [pattern, assetType] of Object.entries(
      ASSET_TYPE_URL_PATTERNS,
    )) {
      if (normalizedUrl.includes(pattern)) {
        return assetType;
      }
    }

    return null;
  }

  /**
   * Extract canonical URL from page and detect correct asset type
   * This is crucial for fixing mismatches between requested URL type and actual asset type
   */
  private extractCanonicalAssetType(
    $: cheerio.CheerioAPI,
    requestedUrl: string,
  ): {
    canonicalUrl: string | null;
    detectedType: MorningstarAssetType | null;
  } {
    // Strategy 1: Check canonical link tag (most reliable)
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || null;

    if (canonicalUrl) {
      const detectedType = this.detectAssetTypeFromUrl(canonicalUrl);
      if (detectedType) {
        this.logger.debug(
          `[VERIFY] Detected asset type from canonical URL: ${detectedType} (${canonicalUrl})`,
        );
        return { canonicalUrl, detectedType };
      }
    }

    // Strategy 2: Check og:url meta tag
    const ogUrl = $('meta[property="og:url"]').attr('content') || null;
    if (ogUrl) {
      const detectedType = this.detectAssetTypeFromUrl(ogUrl);
      if (detectedType) {
        this.logger.debug(
          `[VERIFY] Detected asset type from og:url: ${detectedType} (${ogUrl})`,
        );
        return { canonicalUrl: ogUrl, detectedType };
      }
    }

    // Strategy 3: Fallback to current URL
    const detectedType = this.detectAssetTypeFromUrl(requestedUrl);
    return { canonicalUrl: null, detectedType };
  }

  /**
   * Extract additional info (ticker, category, currency)
   */
  private extractAdditionalInfo(
    $: cheerio.CheerioAPI,
    url: string,
    result: VerificationResult,
  ): void {
    const pageText = $('body').text();
    const pageTitle = $('title').text() || '';
    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';

    // Extract canonical asset type - this is critical for correct type detection
    const { canonicalUrl, detectedType } = this.extractCanonicalAssetType(
      $,
      url,
    );
    if (canonicalUrl) {
      result.additionalInfo.canonicalUrl = canonicalUrl;
    }
    if (detectedType) {
      result.additionalInfo.detectedAssetType = detectedType;
    }

    // Ticker extraction with multiple fallback strategies
    // 1. From URL path for stocks (most reliable for stocks): /stocks/{exchange}/{ticker}/quote
    // Example: morningstar.com/stocks/xnys/nke/quote -> NKE
    const stockUrlMatch = url.match(/\/stocks\/[a-z]+\/([a-z0-9.]+)(?:\/|$)/i);
    if (stockUrlMatch?.[1]) {
      result.additionalInfo.ticker = stockUrlMatch[1].toUpperCase();
      this.logger.debug(
        `[VERIFY] Extracted ticker from stock URL path: ${result.additionalInfo.ticker}`,
      );
    }

    // 2. From URL parameter: ?ticker=CELH
    if (!result.additionalInfo.ticker) {
      const urlTickerMatch = url.match(/[?&]ticker=([A-Z0-9.]{1,10})/i);
      if (urlTickerMatch?.[1]) {
        result.additionalInfo.ticker = urlTickerMatch[1].toUpperCase();
        this.logger.debug(
          `[VERIFY] Extracted ticker from URL param: ${result.additionalInfo.ticker}`,
        );
      }
    }

    // 3. From meta keywords (e.g., "NKE, Nike Stock, NKE Stock Price...")
    // The ticker is often the first keyword for stocks
    if (!result.additionalInfo.ticker && metaKeywords) {
      const keywordsTickerMatch = metaKeywords.match(/^([A-Z]{1,5})(?:,|\s)/);
      if (keywordsTickerMatch?.[1]) {
        result.additionalInfo.ticker = keywordsTickerMatch[1].toUpperCase();
        this.logger.debug(
          `[VERIFY] Extracted ticker from meta keywords: ${result.additionalInfo.ticker}`,
        );
      }
    }

    // 4. From page title (e.g., "Nike Inc Class B NKE" or "CELH Precio de las acciones...")
    if (!result.additionalInfo.ticker) {
      // Try pattern at end: "Company Name TICKER"
      const titleEndMatch = pageTitle.match(/\s([A-Z]{1,5})(?:\s|$)/);
      // Try pattern at start: "TICKER Price..."
      const titleStartMatch = pageTitle.match(
        /^([A-Z]{1,5})\s+(?:Precio|Price|Quote)/i,
      );
      const titleMatch = titleEndMatch || titleStartMatch;
      if (titleMatch?.[1]) {
        result.additionalInfo.ticker = titleMatch[1].toUpperCase();
        this.logger.debug(
          `[VERIFY] Extracted ticker from title: ${result.additionalInfo.ticker}`,
        );
      }
    }

    // 5. Fallback: Look for Ticker/Symbol label in page text
    if (!result.additionalInfo.ticker) {
      const textTickerMatch = pageText.match(
        /(?:Ticker|Symbol)[:\s]*([A-Z0-9.]{1,10})/i,
      );
      if (textTickerMatch?.[1]) {
        result.additionalInfo.ticker = textTickerMatch[1].trim().toUpperCase();
        this.logger.debug(
          `[VERIFY] Extracted ticker from page text: ${result.additionalInfo.ticker}`,
        );
      }
    }

    // Other additional info
    const infoPatterns: Record<string, RegExp> = {
      category: /(?:Categoría|Category)[:\s]*([^\n\r<]{3,50})/i,
      currency: /(?:Divisa|Currency)[:\s]*([A-Z]{3})/i,
    };

    for (const [key, pattern] of Object.entries(infoPatterns)) {
      const match = pageText.match(pattern);
      if (match?.[1]) {
        result.additionalInfo[key] = match[1].trim();
      }
    }
  }

  /**
   * Verify fund page with multi-market and multi-type fallback
   * If the fund is not available in the default Spanish market, try:
   * 1. Different asset types (ETF, Fondo) in Spanish market
   * 2. Different European markets with each asset type (in parallel batches)
   *
   * Performance: Uses parallel requests in batches to reduce total HTTP calls
   * from O(markets × types) sequential to O(markets × types / batchSize) batches
   */
  async verifyFundPageWithFallback(
    morningstarId: string,
    expectedIsin: string,
    assetType: MorningstarAssetType = MS_ASSET_TYPES.FUND,
  ): Promise<ExtendedVerificationResult> {
    const assetTypesToTry = this.getAssetTypePriority(assetType);

    // First, try all asset types in the default Spanish market (fast path)
    const esResult = await this.tryDefaultMarket(
      morningstarId,
      expectedIsin,
      assetTypesToTry,
    );
    if (esResult) {
      return esResult;
    }

    this.logger.log(
      `[FALLBACK] ${morningstarId} not available in ES market with any type, trying other markets in parallel...`,
    );

    // Try other European markets in parallel batches
    const marketResult = await this.tryMarketsInParallel(
      morningstarId,
      expectedIsin,
      assetTypesToTry,
    );
    if (marketResult) {
      return marketResult;
    }

    // If no combination worked, return the original result
    const defaultUrl = buildMorningstarUrl(morningstarId, assetType);
    const verification = await this.verifyFundPage(defaultUrl, expectedIsin);
    this.logger.warn(
      `[FALLBACK] ${morningstarId} not found in any European market with any asset type`,
    );
    return { verification, workingUrl: defaultUrl };
  }

  /**
   * Get asset types to try, prioritizing the provided type
   */
  private getAssetTypePriority(
    assetType: MorningstarAssetType,
  ): MorningstarAssetType[] {
    if (assetType === MS_ASSET_TYPES.ETF) {
      return [MS_ASSET_TYPES.ETF, MS_ASSET_TYPES.FUND];
    }
    if (assetType === MS_ASSET_TYPES.FUND) {
      return [MS_ASSET_TYPES.FUND, MS_ASSET_TYPES.ETF];
    }
    return [assetType, MS_ASSET_TYPES.FUND, MS_ASSET_TYPES.ETF];
  }

  /**
   * Try default Spanish market with all asset types
   * Uses canonical URL detection to determine the correct asset type
   */
  private async tryDefaultMarket(
    morningstarId: string,
    expectedIsin: string,
    assetTypesToTry: MorningstarAssetType[],
  ): Promise<ExtendedVerificationResult | null> {
    for (const tryAssetType of assetTypesToTry) {
      const defaultUrl = buildMorningstarUrl(morningstarId, tryAssetType);
      const verification = await this.verifyFundPage(defaultUrl, expectedIsin);

      if (this.isValidResult(verification)) {
        // Check if the canonical URL indicates a different asset type
        const canonicalDetectedType = verification.additionalInfo
          ?.detectedAssetType as MorningstarAssetType | undefined;

        // If canonical URL shows a different type, use that and rebuild the URL
        if (canonicalDetectedType && canonicalDetectedType !== tryAssetType) {
          this.logger.log(
            `[FALLBACK] Type mismatch detected: requested ${tryAssetType} but canonical shows ${canonicalDetectedType}`,
          );
          const correctedUrl = buildMorningstarUrl(
            morningstarId,
            canonicalDetectedType,
          );
          this.logger.log(
            `[FALLBACK] Found ${morningstarId} as ${canonicalDetectedType} in ES market (ISIN: ${verification.isinFound})`,
          );
          return {
            verification,
            workingUrl: correctedUrl,
            detectedAssetType: canonicalDetectedType,
          };
        }

        this.logger.log(
          `[FALLBACK] Found ${morningstarId} as ${tryAssetType} in ES market (ISIN: ${verification.isinFound})`,
        );
        return {
          verification,
          workingUrl: defaultUrl,
          detectedAssetType: tryAssetType,
        };
      }
    }
    return null;
  }

  /**
   * Try European markets in parallel batches for better performance
   * Processes BATCH_SIZE markets concurrently, stopping at first success
   * Uses canonical URL detection to determine the correct asset type
   */
  private async tryMarketsInParallel(
    morningstarId: string,
    expectedIsin: string,
    assetTypesToTry: MorningstarAssetType[],
  ): Promise<ExtendedVerificationResult | null> {
    const BATCH_SIZE = 3; // Process 3 markets in parallel

    for (let i = 0; i < EUROPEAN_MARKETS.length; i += BATCH_SIZE) {
      const marketBatch = EUROPEAN_MARKETS.slice(i, i + BATCH_SIZE);

      this.logger.debug(
        `[FALLBACK] Trying markets batch: ${marketBatch.join(', ')}`,
      );

      // Create verification tasks for all market/type combinations in this batch
      const verificationTasks = marketBatch.flatMap((marketId) =>
        assetTypesToTry.map(async (tryAssetType) => {
          const marketUrl = buildMorningstarUrl(
            morningstarId,
            tryAssetType,
            marketId,
          );
          const verification = await this.verifyFundPage(
            marketUrl,
            expectedIsin,
          );
          return { verification, marketUrl, marketId, tryAssetType };
        }),
      );

      // Execute all tasks in parallel
      const results = await Promise.all(verificationTasks);

      // Find first successful result
      const successResult = results.find((r) =>
        this.isValidResult(r.verification),
      );
      if (successResult) {
        // Check if the canonical URL indicates a different asset type
        const canonicalDetectedType = successResult.verification.additionalInfo
          ?.detectedAssetType as MorningstarAssetType | undefined;

        // Determine the final asset type (prefer canonical detection)
        const finalAssetType =
          canonicalDetectedType || successResult.tryAssetType;

        // Rebuild URL if canonical type differs from requested type
        let finalUrl = successResult.marketUrl;
        if (
          canonicalDetectedType &&
          canonicalDetectedType !== successResult.tryAssetType
        ) {
          this.logger.log(
            `[FALLBACK] Type mismatch in ${successResult.marketId.toUpperCase()}: requested ${successResult.tryAssetType} but canonical shows ${canonicalDetectedType}`,
          );
          finalUrl = buildMorningstarUrl(
            morningstarId,
            canonicalDetectedType,
            successResult.marketId,
          );
        }

        this.logger.log(
          `[FALLBACK] Found ${morningstarId} as ${finalAssetType} in ${successResult.marketId.toUpperCase()} market (ISIN: ${successResult.verification.isinFound})`,
        );
        return {
          verification: successResult.verification,
          workingUrl: finalUrl,
          marketId: successResult.marketId,
          detectedAssetType: finalAssetType,
        };
      }
    }

    return null;
  }

  /**
   * Check if verification result is valid (found and has ISIN)
   */
  private isValidResult(verification: VerificationResult): boolean {
    return (
      verification.additionalInfo?.marketNotAvailable !== 'true' &&
      verification.isinFound !== null
    );
  }
}
