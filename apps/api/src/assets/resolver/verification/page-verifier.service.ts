import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { VerificationResult } from '../resolver.types';
import {
  EUROPEAN_MARKETS,
  MS_ASSET_TYPES,
  MorningstarAssetType,
  SHARE_CLASS_LOOKUP_RETRIES,
  SHARE_CLASS_LOOKUP_RETRY_DELAY_MS,
  isMorningstarBotChallenge,
} from '../utils/constants';
import {
  buildMorningstarUrl,
  buildWwwMorningstarQuoteUrl,
} from '../utils/url-builder';
import {
  extractShareClassIdFromHtml,
  isValidIsin,
} from '../utils/id-extractor';
import { extractLabeledIsin } from '../utils/www-morningstar-quote';
import {
  extractTickerFromQuotePage,
  isQuoteVerificationValid,
  parseQuoteHeaderIdentity,
} from '../utils/quote-page-fields';
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
    httpOptions?: { retries?: number; retryDelay?: number },
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
      retries: httpOptions?.retries,
      retryDelay: httpOptions?.retryDelay,
    });

    if (!response.ok) {
      this.logger.warn(`[VERIFY] HTTP ${response.status}`);
      result.additionalInfo.httpStatus = response.status.toString();
      if (isMorningstarBotChallenge(response.status, response.error?.message)) {
        result.additionalInfo.botChallenge = 'true';
      }
      if (response.status === 404) {
        result.additionalInfo.marketNotAvailable = 'true';
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
    const foundIsins = this.extractIsins($, html);
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

    // Extract additional info (ticker, category, currency, share-class ID)
    this.extractAdditionalInfo($, url, result);
    const shareClassId = extractShareClassIdFromHtml(html);
    if (shareClassId) {
      result.additionalInfo.shareClassId = shareClassId;
      this.logger.debug(
        `[VERIFY] Share-class ID from quote page: ${shareClassId}`,
      );
    }

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
  private extractIsins($: cheerio.CheerioAPI, html: string): string[] {
    const foundIsins: string[] = [];

    const headerIdentity = parseQuoteHeaderIdentity($('body').text());
    if (headerIdentity?.isin) {
      foundIsins.push(headerIdentity.isin);
    }

    const labeledIsin = extractLabeledIsin(html);
    if (labeledIsin && !foundIsins.includes(labeledIsin)) {
      foundIsins.push(labeledIsin);
    }

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
          // Country prefix + ISO 6166 checksum. Rejects CSS keys like
          // YEARLOWPRICE that pass Luhn but are not real ISINs.
          if (
            isValidIsin(candidate) &&
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
    const headerIdentity = parseQuoteHeaderIdentity($('body').text());
    if (headerIdentity) {
      this.logger.debug(
        `[VERIFY] Detected asset type from quote header: ${headerIdentity.assetType} (ISIN: ${headerIdentity.isin})`,
      );
      return {
        canonicalUrl: $('link[rel="canonical"]').attr('href') || null,
        detectedType: headerIdentity.assetType,
      };
    }

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

    const ticker = extractTickerFromQuotePage({
      url,
      pageTitle,
      metaKeywords,
      pageText,
    });
    if (ticker) {
      result.additionalInfo.ticker = ticker;
      this.logger.debug(`[VERIFY] Extracted ticker: ${ticker}`);
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

    const wwwResult = await this.tryWwwMorningstarQuote(
      morningstarId,
      expectedIsin,
      assetTypesToTry,
    );
    if (
      wwwResult &&
      this.isValidResult(wwwResult.verification, wwwResult.detectedAssetType)
    ) {
      return wwwResult;
    }
    if (wwwResult && this.isBotChallenge(wwwResult.verification)) {
      this.logger.warn(
        `[FALLBACK] Skipping global.morningstar.com after bot challenge for ${morningstarId}`,
      );
      return wwwResult;
    }

    // First, try all asset types in the default Spanish market (fast path)
    const esResult = await this.tryDefaultMarket(
      morningstarId,
      expectedIsin,
      assetTypesToTry,
    );
    if (esResult) {
      return esResult;
    }

    const euResult = await this.tryEuQuoteMarket(
      morningstarId,
      expectedIsin,
      assetTypesToTry,
    );
    if (euResult) {
      return euResult;
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
      return [MS_ASSET_TYPES.ETF, MS_ASSET_TYPES.FUND, MS_ASSET_TYPES.STOCK];
    }
    if (assetType === MS_ASSET_TYPES.FUND) {
      return [MS_ASSET_TYPES.FUND, MS_ASSET_TYPES.ETF, MS_ASSET_TYPES.STOCK];
    }
    return [assetType, MS_ASSET_TYPES.ETF, MS_ASSET_TYPES.FUND];
  }

  /**
   * www.morningstar.com quote pages are less often WAF-blocked than global.morningstar.com
   */
  private async tryWwwMorningstarQuote(
    morningstarId: string,
    expectedIsin: string,
    assetTypesToTry: MorningstarAssetType[],
  ): Promise<ExtendedVerificationResult | null> {
    for (const tryAssetType of assetTypesToTry) {
      const wwwUrl = buildWwwMorningstarQuoteUrl(morningstarId, tryAssetType);
      const verification = await this.verifyFundPage(wwwUrl, expectedIsin, {
        retries: SHARE_CLASS_LOOKUP_RETRIES,
        retryDelay: SHARE_CLASS_LOOKUP_RETRY_DELAY_MS,
      });
      if (this.isBotChallenge(verification)) {
        this.logger.warn(
          `[FALLBACK] www.morningstar.com bot challenge for ${morningstarId}`,
        );
        return {
          verification,
          workingUrl: wwwUrl,
          marketId: 'www',
          detectedAssetType: tryAssetType,
        };
      }
      if (this.isValidResult(verification, tryAssetType)) {
        this.logger.log(
          `[FALLBACK] Found ${morningstarId} as ${tryAssetType} on www.morningstar.com (ISIN: ${verification.isinFound})`,
        );
        return {
          verification,
          workingUrl: wwwUrl,
          marketId: 'www',
          detectedAssetType:
            (verification.additionalInfo?.detectedAssetType as
              | MorningstarAssetType
              | undefined) || tryAssetType,
        };
      }
    }
    return null;
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

      if (this.isValidResult(verification, tryAssetType)) {
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
   * UCITS funds often live on /en-eu/investments/.../quote without a marketID
   */
  private async tryEuQuoteMarket(
    morningstarId: string,
    expectedIsin: string,
    assetTypesToTry: MorningstarAssetType[],
  ): Promise<ExtendedVerificationResult | null> {
    for (const tryAssetType of assetTypesToTry) {
      const euUrl = buildMorningstarUrl(morningstarId, tryAssetType, 'eu');
      const verification = await this.verifyFundPage(euUrl, expectedIsin);
      if (this.isValidResult(verification, tryAssetType)) {
        const canonicalDetectedType = verification.additionalInfo
          ?.detectedAssetType as MorningstarAssetType | undefined;
        const finalAssetType = canonicalDetectedType || tryAssetType;
        const finalUrl =
          canonicalDetectedType && canonicalDetectedType !== tryAssetType
            ? buildMorningstarUrl(morningstarId, canonicalDetectedType, 'eu')
            : euUrl;

        if (canonicalDetectedType && canonicalDetectedType !== tryAssetType) {
          this.logger.log(
            `[FALLBACK] Type mismatch on en-eu quote: requested ${tryAssetType} but canonical shows ${canonicalDetectedType}`,
          );
        }

        this.logger.log(
          `[FALLBACK] Found ${morningstarId} as ${finalAssetType} on en-eu quote (ISIN: ${verification.isinFound})`,
        );
        return {
          verification,
          workingUrl: finalUrl,
          marketId: 'eu',
          detectedAssetType: finalAssetType,
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
        this.isValidResult(r.verification, r.tryAssetType),
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
   * A quote page is valid with an ISIN, or with a name plus a detected type.
   * ETF/fund pages must not fall through to STOCK when ISIN is missing from HTML.
   */
  private isValidResult(
    verification: VerificationResult,
    assetType?: MorningstarAssetType,
  ): boolean {
    return isQuoteVerificationValid({
      marketNotAvailable:
        verification.additionalInfo?.marketNotAvailable === 'true',
      isinFound: verification.isinFound,
      nameFound: verification.nameFound,
      detectedAssetType: verification.additionalInfo?.detectedAssetType,
      triedAssetType: assetType,
    });
  }

  private isBotChallenge(verification: VerificationResult): boolean {
    return verification.additionalInfo?.botChallenge === 'true';
  }
}
