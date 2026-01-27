import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { VerificationResult, MorningstarAssetType } from '../resolver.types';
import { EUROPEAN_MARKETS } from '../utils/constants';
import { isValidIsin } from '../utils/id-extractor';
import { buildMorningstarUrl } from '../utils/url-builder';
import { HttpClientService } from '../../../common/http';

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
 * Service responsible for verifying Morningstar pages and extracting data
 */
@Injectable()
export class PageVerifierService {
  private readonly logger = new Logger(PageVerifierService.name);

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
          if (isValidIsin(candidate) && !foundIsins.includes(candidate)) {
            foundIsins.push(candidate);
            this.logger.debug(`[VERIFY] Found valid ISIN: ${candidate}`);
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
   * Extract additional info (ticker, category, currency)
   */
  private extractAdditionalInfo(
    $: cheerio.CheerioAPI,
    url: string,
    result: VerificationResult,
  ): void {
    const pageText = $('body').text();
    const pageTitle = $('title').text() || '';

    // Ticker extraction with multiple fallback strategies
    // 1. From URL parameter (most reliable): ?ticker=CELH
    const urlTickerMatch = url.match(/[?&]ticker=([A-Z0-9]{1,10})/i);
    if (urlTickerMatch?.[1]) {
      result.additionalInfo.ticker = urlTickerMatch[1].toUpperCase();
      this.logger.debug(
        `[VERIFY] Extracted ticker from URL: ${result.additionalInfo.ticker}`,
      );
    }

    // 2. From page title (e.g., "CELH Precio de las acciones de Celsius...")
    if (!result.additionalInfo.ticker) {
      const titleTickerMatch = pageTitle.match(
        /^([A-Z]{1,5})\s+(?:Precio|Price|Quote)/i,
      );
      if (titleTickerMatch?.[1]) {
        result.additionalInfo.ticker = titleTickerMatch[1].toUpperCase();
        this.logger.debug(
          `[VERIFY] Extracted ticker from title: ${result.additionalInfo.ticker}`,
        );
      }
    }

    // 3. Fallback: Look for Ticker/Symbol label in page text
    if (!result.additionalInfo.ticker) {
      const textTickerMatch = pageText.match(
        /(?:Ticker|Symbol)[:\s]*([A-Z0-9]{1,10})/i,
      );
      if (textTickerMatch?.[1]) {
        result.additionalInfo.ticker = textTickerMatch[1].trim().toUpperCase();
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
    assetType: MorningstarAssetType = 'Fondo',
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
    if (assetType === 'ETF') {
      return ['ETF', 'Fondo'];
    }
    if (assetType === 'Fondo') {
      return ['Fondo', 'ETF'];
    }
    return [assetType, 'Fondo', 'ETF'];
  }

  /**
   * Try default Spanish market with all asset types
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
        this.logger.log(
          `[FALLBACK] Found ${morningstarId} as ${successResult.tryAssetType} in ${successResult.marketId.toUpperCase()} market (ISIN: ${successResult.verification.isinFound})`,
        );
        return {
          verification: successResult.verification,
          workingUrl: successResult.marketUrl,
          marketId: successResult.marketId,
          detectedAssetType: successResult.tryAssetType,
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
