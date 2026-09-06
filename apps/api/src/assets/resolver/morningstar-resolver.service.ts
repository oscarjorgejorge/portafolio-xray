import { Injectable } from '@nestjs/common';
import {
  SearchResult,
  ScoredResult,
  ResolutionResult,
  VerificationResult,
} from './resolver.types';
import {
  IdentifierClassifier,
  IdentifierType,
} from '../../common/utils/identifier-classifier';
import { createContextLogger } from '../../common/logger';
import {
  DEFAULT_RESOLVER_CONFIG,
  SCORE_WEIGHTS,
  MS_ASSET_TYPES,
  MorningstarAssetType,
} from './utils/constants';
import {
  isFundShareClassId,
  resolveShareClassId,
} from './utils/canonical-fund-id';
import { extractMorningstarIdFromUrl } from './utils/id-extractor';
import {
  canonicalMorningstarQuoteUrl,
  detectAssetTypeFromMorningstarUrl,
} from './utils/url-builder';

// Search strategies
import { ApiSearchStrategy } from './strategies/api-search.strategy';
import { HtmlScrapeStrategy } from './strategies/html-scrape.strategy';
import { GlobalSearchStrategy } from './strategies/global-search.strategy';
import { DuckDuckGoStrategy } from './strategies/duckduckgo.strategy';
import { YahooFinanceSearchStrategy } from './strategies/yahoo-finance.strategy';
import { InstantXrayScreenerStrategy } from './strategies/instant-xray-screener.strategy';

// Scoring and verification
import { ResultScorerService } from './scoring/result-scorer.service';
import { PageVerifierService } from './verification/page-verifier.service';

// Interface
import { IMorningstarResolver } from '../interfaces';

/**
 * MorningstarResolverService
 * Orchestrates resolution of ISIN/ticker/text to Morningstar IDs
 * using multiple search strategies, scoring, and page verification.
 */
@Injectable()
export class MorningstarResolverService implements IMorningstarResolver {
  private readonly logger = createContextLogger(
    MorningstarResolverService.name,
  );
  private readonly config = DEFAULT_RESOLVER_CONFIG;

  constructor(
    private readonly apiSearch: ApiSearchStrategy,
    private readonly htmlScrape: HtmlScrapeStrategy,
    private readonly globalSearch: GlobalSearchStrategy,
    private readonly duckDuckGo: DuckDuckGoStrategy,
    private readonly yahooSearch: YahooFinanceSearchStrategy,
    private readonly instantXrayScreener: InstantXrayScreenerStrategy,
    private readonly scorer: ResultScorerService,
    private readonly verifier: PageVerifierService,
  ) {}

  /**
   * Search using all strategies and combine results
   */
  private async searchAll(query: string): Promise<SearchResult[]> {
    // Instant X-Ray's lt.morningstar.com screener is not WAF-blocked and
    // returns 0P IDs for stocks/ETFs. Yahoo + www.morningstar.com is fallback.
    if (
      IdentifierClassifier.isISIN(query) ||
      IdentifierClassifier.isTicker(query)
    ) {
      const screenerResults = await this.instantXrayScreener.search(query);
      if (screenerResults.length > 0) {
        this.logger.debug(
          `Instant X-Ray screener found ${screenerResults.length} result(s) for ${query}`,
        );
        return screenerResults.slice(0, this.config.maxResults);
      }

      const yahooResults = await this.yahooSearch.search(query);
      if (yahooResults.length > 0) {
        this.logger.debug(
          `Yahoo/www.morningstar found ${yahooResults.length} result(s) for ${query}`,
        );
        return yahooResults.slice(0, this.config.maxResults);
      }
    }

    // Execute primary strategies in parallel
    const [apiResults, globalResults, ddgResults] = await Promise.all([
      this.apiSearch.search(query),
      this.globalSearch.search(query),
      this.duckDuckGo.search(query),
    ]);

    // Priority: API first (best source)
    const allResults: SearchResult[] = [
      ...apiResults,
      ...globalResults,
      ...ddgResults,
    ];

    // If nothing found, try HTML scraping
    if (allResults.length === 0) {
      const htmlResults = await this.htmlScrape.search(query);
      allResults.push(...htmlResults);
    }

    // Deduplicate by Morningstar ID
    const seen = new Set<string>();
    const unique = allResults.filter((r) => {
      if (!r.morningstarId) return true;
      if (seen.has(r.morningstarId)) return false;
      seen.add(r.morningstarId);
      return true;
    });

    this.logger.debug(`Total unique results: ${unique.length}`);

    return unique.slice(0, this.config.maxResults);
  }

  /**
   * Resolve an asset identifier to Morningstar ID
   * @param input - ISIN, Morningstar ID, ticker, or free text
   * @returns Resolution result with confidence score
   */
  async resolve(input: string): Promise<ResolutionResult> {
    const morningstarFromUrl = extractMorningstarIdFromUrl(input);
    const normalizedInput =
      morningstarFromUrl ?? IdentifierClassifier.normalizeInput(input);
    const inputType = morningstarFromUrl
      ? IdentifierType.MORNINGSTAR_ID
      : IdentifierClassifier.classify(normalizedInput);

    this.logger.log(`Resolving: ${input} (type: ${inputType})`);

    // Pasted quote URLs already contain the ID; skip search (often WAF-blocked).
    const searchResults = morningstarFromUrl
      ? []
      : await this.searchAll(normalizedInput);

    // Score and sort results
    let scoredResults = this.scorer.scoreAndSortResults(
      searchResults,
      input,
      inputType,
    );

    // Prioritize fund results with "F" ID
    scoredResults = this.scorer.prioritizeFundResults(scoredResults);

    // Filter duplicate names to reduce alternatives
    scoredResults = this.scorer.filterDuplicateNames(scoredResults);

    // Determine initial state
    let bestMatch = scoredResults[0] || null;
    let status: 'resolved' | 'needs_review' | 'not_found' = 'not_found';
    let confidence = 0;
    let verification: VerificationResult | undefined = undefined;

    if (
      inputType === IdentifierType.MORNINGSTAR_ID &&
      bestMatch?.morningstarId
    ) {
      const result = await this.handleMorningstarIdInput(
        normalizedInput,
        bestMatch,
        scoredResults,
      );
      bestMatch = result.bestMatch;
      status = result.status;
      confidence = result.confidence;
      verification = result.verification;
      scoredResults = result.scoredResults;
    } else if (inputType === IdentifierType.MORNINGSTAR_ID && !bestMatch) {
      const result = await this.handleDirectMorningstarIdResolution(
        normalizedInput,
        morningstarFromUrl ? input : undefined,
      );
      if (result) {
        bestMatch = result.bestMatch;
        status = result.status;
        confidence = result.confidence;
        verification = result.verification;
        scoredResults = [result.bestMatch];
      }
    } else if (bestMatch?.morningstarId && inputType === IdentifierType.ISIN) {
      const result = await this.handleIsinInput(
        normalizedInput,
        bestMatch,
        scoredResults,
      );
      bestMatch = result.bestMatch;
      verification = result.verification;
      scoredResults = result.scoredResults;
    } else if (
      bestMatch?.morningstarId &&
      !bestMatch.isin &&
      (inputType === IdentifierType.FREE_TEXT ||
        inputType === IdentifierType.TICKER)
    ) {
      const result = await this.handleFreeTextOrTickerInput(bestMatch);
      bestMatch = result.bestMatch;
      verification = result.verification;
    }

    // Calculate final confidence and status
    if (bestMatch && status !== 'resolved') {
      confidence = this.scorer.calculateConfidence(
        bestMatch,
        inputType,
        verification?.verified ?? false,
      );

      status = this.determineStatus(
        bestMatch,
        scoredResults,
        confidence,
        verification?.verified ?? false,
        inputType,
      );
    }

    // Get the final best match
    const finalBestMatch = scoredResults[0] || bestMatch || null;

    const result: ResolutionResult = {
      input,
      inputType,
      normalizedInput,
      timestamp: new Date().toISOString(),
      status,
      confidence,
      bestMatch: finalBestMatch,
      allResults: scoredResults,
      morningstarId: finalBestMatch?.morningstarId || null,
      morningstarUrl: finalBestMatch?.url || null,
      verification,
    };

    this.logger.log(
      `Resolution complete: status=${status}, confidence=${(confidence * 100).toFixed(1)}%, morningstarId=${result.morningstarId}`,
    );

    return result;
  }

  /**
   * Handle Morningstar ID input type
   */
  private async handleMorningstarIdInput(
    normalizedInput: string,
    bestMatch: ScoredResult,
    scoredResults: ScoredResult[],
  ): Promise<{
    bestMatch: ScoredResult;
    status: 'resolved' | 'needs_review' | 'not_found';
    confidence: number;
    verification?: VerificationResult;
    scoredResults: ScoredResult[];
  }> {
    if (bestMatch.morningstarId?.toUpperCase() !== normalizedInput) {
      return {
        bestMatch,
        status: 'needs_review',
        confidence: 0,
        scoredResults,
      };
    }

    // Verify the page with multi-market fallback
    const { verification, workingUrl, marketId, detectedAssetType } =
      await this.verifier.verifyFundPageWithFallback(
        bestMatch.morningstarId,
        '',
        bestMatch.assetType || MS_ASSET_TYPES.FUND,
      );

    // Update the URL if we found a working market
    if (workingUrl !== bestMatch.url) {
      bestMatch.url = workingUrl;
      if (marketId) {
        bestMatch.snippet = `${bestMatch.snippet} | Market: ${marketId.toUpperCase()}`;
      }
    }

    // Update asset type if detected
    if (detectedAssetType && detectedAssetType !== bestMatch.assetType) {
      bestMatch.assetType = detectedAssetType;
    }

    // Update ISIN if found
    if (verification?.isinFound && !bestMatch.isin) {
      bestMatch.isin = verification.isinFound;
    }

    // Update ticker if found from page verification
    if (verification?.additionalInfo?.ticker && !bestMatch.ticker) {
      bestMatch.ticker = verification.additionalInfo.ticker;
    }

    if (verification?.nameFound) {
      bestMatch.title = verification.nameFound;
    }

    this.applyShareClassId(bestMatch, verification);

    this.logger.log(
      `Exact Morningstar ID match found: ${normalizedInput} -> ${bestMatch.morningstarId}${verification?.isinFound ? ` (ISIN: ${verification.isinFound})` : ''}${marketId ? ` (market: ${marketId})` : ''}`,
    );

    return {
      bestMatch,
      status: 'resolved',
      confidence: 1.0,
      verification,
      scoredResults,
    };
  }

  /**
   * Handle direct Morningstar ID resolution when no search results found
   */
  private async handleDirectMorningstarIdResolution(
    normalizedInput: string,
    pastedUrl?: string,
  ): Promise<{
    bestMatch: ScoredResult;
    status: 'resolved' | 'needs_review' | 'not_found';
    confidence: number;
    verification?: VerificationResult;
  } | null> {
    this.logger.log(
      `[DIRECT] No search results for Morningstar ID ${normalizedInput}, trying direct verification...`,
    );

    const pastedAssetType = pastedUrl
      ? detectAssetTypeFromMorningstarUrl(pastedUrl)
      : undefined;

    if (pastedUrl && /https?:\/\//i.test(pastedUrl)) {
      const quoteUrl = canonicalMorningstarQuoteUrl(pastedUrl, normalizedInput);
      const pastedVerification = await this.verifier.verifyFundPage(
        quoteUrl,
        '',
      );
      if (pastedVerification.isinFound || pastedVerification.nameFound) {
        return this.buildDirectResolutionMatch(
          normalizedInput,
          quoteUrl,
          pastedVerification,
          pastedAssetType || MS_ASSET_TYPES.FUND,
        );
      }
    }

    const assetTypesToTry: MorningstarAssetType[] = pastedAssetType
      ? [
          pastedAssetType,
          MS_ASSET_TYPES.STOCK,
          MS_ASSET_TYPES.ETF,
          MS_ASSET_TYPES.FUND,
        ].filter((type, index, all) => all.indexOf(type) === index)
      : [MS_ASSET_TYPES.STOCK, MS_ASSET_TYPES.ETF, MS_ASSET_TYPES.FUND];
    let foundAssetType: MorningstarAssetType = MS_ASSET_TYPES.FUND;
    let verResultFound: VerificationResult | null = null;
    let workingUrlFound = '';
    let marketIdFound: string | undefined;

    for (const tryAssetType of assetTypesToTry) {
      const { verification, workingUrl, marketId } =
        await this.verifier.verifyFundPageWithFallback(
          normalizedInput,
          '',
          tryAssetType,
        );

      if (verification.isinFound || verification.nameFound) {
        foundAssetType = tryAssetType;
        verResultFound = verification;
        workingUrlFound = workingUrl;
        marketIdFound = marketId;
        break;
      }
    }

    const { verification, workingUrl, marketId } = verResultFound
      ? {
          verification: verResultFound,
          workingUrl: workingUrlFound,
          marketId: marketIdFound,
        }
      : await this.verifier.verifyFundPageWithFallback(
          normalizedInput,
          '',
          MS_ASSET_TYPES.FUND,
        );

    // If we found the fund in any market
    if (verification.isinFound || verification.nameFound) {
      return this.buildDirectResolutionMatch(
        normalizedInput,
        workingUrl,
        verification,
        foundAssetType,
        marketId,
      );
    }

    return null;
  }

  private buildDirectResolutionMatch(
    morningstarId: string,
    url: string,
    verification: VerificationResult,
    assetType: MorningstarAssetType,
    marketId?: string,
  ) {
    const bestMatch: ScoredResult = {
      url,
      title: verification.nameFound || morningstarId,
      snippet: `Direct resolution | Tipo: ${assetType}${marketId ? ` | Market: ${marketId.toUpperCase()}` : ''}`,
      morningstarId,
      domain: 'global.morningstar.com',
      isin: verification.isinFound || undefined,
      ticker: verification.additionalInfo?.ticker || undefined,
      assetType,
      score: 100,
      scoreBreakdown: {
        isinMatch: 0,
        tickerMatch: 0,
        nameMatch: 0,
        morningstarDomain: 20,
        typeMatch: 10,
        morningstarIdMatch: 100,
      },
    };

    this.logger.log(
      `[DIRECT] ${assetType} resolved via direct verification: ${morningstarId}${verification.isinFound ? ` (ISIN: ${verification.isinFound})` : ''}${marketId ? ` (market: ${marketId})` : ''}`,
    );

    this.applyShareClassId(bestMatch, verification);

    return {
      bestMatch,
      status: 'resolved' as const,
      confidence: 1.0,
      verification,
    };
  }

  /**
   * Prefer the URL search already found (www.morningstar.com ticker/ETF pages).
   * `/etfs/_/{id}/quote` and `/stocks/_/{id}/quote` often 404.
   */
  private async verifyBestMatchPage(
    bestMatch: ScoredResult,
    expectedIsin: string,
  ) {
    if (bestMatch.url && /morningstar\.com/i.test(bestMatch.url)) {
      const verification = await this.verifier.verifyFundPage(
        bestMatch.url,
        expectedIsin,
      );
      if (verification.isinFound || verification.nameFound) {
        return {
          verification,
          workingUrl: bestMatch.url,
          marketId: bestMatch.url.includes('www.morningstar.com')
            ? 'www'
            : undefined,
          detectedAssetType:
            (verification.additionalInfo?.detectedAssetType as
              | MorningstarAssetType
              | undefined) || bestMatch.assetType,
        };
      }
    }

    return this.verifier.verifyFundPageWithFallback(
      bestMatch.morningstarId!,
      expectedIsin,
      bestMatch.assetType || MS_ASSET_TYPES.FUND,
    );
  }

  /**
   * Handle ISIN input type
   */
  private async handleIsinInput(
    normalizedInput: string,
    bestMatch: ScoredResult,
    scoredResults: ScoredResult[],
  ): Promise<{
    bestMatch: ScoredResult;
    verification?: VerificationResult;
    scoredResults: ScoredResult[];
  }> {
    if (bestMatch.isin?.toUpperCase() === normalizedInput) {
      const hasShareClassId =
        isFundShareClassId(bestMatch.shareClassId) ||
        isFundShareClassId(bestMatch.morningstarId);
      const isStock = bestMatch.assetType === MS_ASSET_TYPES.STOCK;

      if (isStock || hasShareClassId) {
        const verification: VerificationResult = {
          verified: true,
          isinFound: bestMatch.isin,
          nameFound: bestMatch.title,
          additionalInfo: bestMatch.shareClassId
            ? { shareClassId: bestMatch.shareClassId }
            : {},
        };
        this.applyShareClassId(bestMatch, verification);
        this.logger.debug(
          `[ISIN] Skipping quote-page fetch; search already matched ${normalizedInput}`,
        );
        return { bestMatch, verification, scoredResults };
      }

      this.logger.debug(
        `[ISIN] Search matched ${normalizedInput} but share-class ID is missing; fetching quote page`,
      );
    }

    const { verification, workingUrl, marketId, detectedAssetType } =
      await this.verifyBestMatchPage(bestMatch, normalizedInput);

    // Update the URL if we found a working market
    if (workingUrl !== bestMatch.url) {
      bestMatch.url = workingUrl;
      if (marketId) {
        bestMatch.snippet = `${bestMatch.snippet} | Market: ${marketId.toUpperCase()}`;
      }
    }

    // Update asset type if detected
    if (detectedAssetType && detectedAssetType !== bestMatch.assetType) {
      bestMatch.assetType = detectedAssetType;
    }

    if (verification.verified) {
      bestMatch.score += SCORE_WEIGHTS.VERIFICATION_BONUS;
      bestMatch.scoreBreakdown.isinMatch = SCORE_WEIGHTS.VERIFICATION_BONUS;

      if (verification.nameFound) {
        bestMatch.title = verification.nameFound;
      }

      // Update ticker if found from page verification
      if (verification.additionalInfo?.ticker && !bestMatch.ticker) {
        bestMatch.ticker = verification.additionalInfo.ticker;
      }

      scoredResults = scoredResults.sort((a, b) => b.score - a.score);
    }

    this.applyShareClassId(bestMatch, verification);

    return { bestMatch, verification, scoredResults };
  }

  /**
   * Handle FREE_TEXT or TICKER input type (verify to extract ISIN)
   */
  private async handleFreeTextOrTickerInput(bestMatch: ScoredResult): Promise<{
    bestMatch: ScoredResult;
    verification?: VerificationResult;
  }> {
    this.logger.log(
      `[VERIFY] No ISIN from API, verifying page to extract ISIN...`,
    );

    const { verification, workingUrl, marketId, detectedAssetType } =
      await this.verifyBestMatchPage(bestMatch, '');

    // Update the URL if we found a working market
    if (workingUrl !== bestMatch.url) {
      bestMatch.url = workingUrl;
      if (marketId) {
        bestMatch.snippet = `${bestMatch.snippet} | Market: ${marketId.toUpperCase()}`;
      }
    }

    // Update asset type if detected
    if (detectedAssetType && detectedAssetType !== bestMatch.assetType) {
      this.logger.log(
        `[VERIFY] Corrected asset type: ${bestMatch.assetType} -> ${detectedAssetType}`,
      );
      bestMatch.assetType = detectedAssetType;
    }

    // Update ISIN if found
    if (verification?.isinFound) {
      bestMatch.isin = verification.isinFound;
      this.logger.log(
        `[VERIFY] Extracted ISIN from page: ${verification.isinFound}`,
      );
    }

    // Update ticker if found from page verification
    if (verification?.additionalInfo?.ticker && !bestMatch.ticker) {
      bestMatch.ticker = verification.additionalInfo.ticker;
      this.logger.log(
        `[VERIFY] Extracted ticker from page: ${verification.additionalInfo.ticker}`,
      );
    }

    if (verification?.nameFound && !bestMatch.title) {
      bestMatch.title = verification.nameFound;
    }

    this.applyShareClassId(bestMatch, verification);

    return { bestMatch, verification };
  }

  /**
   * Keep quote 0P IDs on morningstarId; stash the Instant X-Ray F ID on verification
   */
  private applyShareClassId(
    bestMatch: ScoredResult,
    verification?: VerificationResult,
  ): void {
    if (!bestMatch.morningstarId || !verification) return;
    const shareClassId = resolveShareClassId(
      bestMatch.morningstarId,
      bestMatch.assetType,
      bestMatch.url,
      verification.additionalInfo?.shareClassId || bestMatch.shareClassId,
    );
    if (
      !shareClassId ||
      verification.additionalInfo?.shareClassId === shareClassId
    ) {
      return;
    }
    this.logger.log(
      `[SHARE CLASS] ${bestMatch.morningstarId} has F ID ${shareClassId}`,
    );
    verification.additionalInfo = {
      ...verification.additionalInfo,
      shareClassId,
    };
  }

  /**
   * Determine final status based on match quality
   */
  private determineStatus(
    bestMatch: ScoredResult,
    scoredResults: ScoredResult[],
    confidence: number,
    verified: boolean,
    inputType: IdentifierType,
  ): 'resolved' | 'needs_review' | 'not_found' {
    // Check if this is a fund with "F" ID that we prioritized
    const isPrioritizedFund =
      bestMatch.assetType === MS_ASSET_TYPES.FUND &&
      bestMatch.morningstarId?.toUpperCase().startsWith('F') &&
      scoredResults.some(
        (r) =>
          r !== bestMatch &&
          r.title &&
          IdentifierClassifier.normalizeInput(r.title) ===
            IdentifierClassifier.normalizeInput(bestMatch.title || ''),
      );

    if (verified) {
      return 'resolved';
    }

    if (isPrioritizedFund && bestMatch.morningstarId) {
      this.logger.log(
        `Auto-resolving fund with "F" ID from multiple same-name results: ${bestMatch.morningstarId}`,
      );
      return 'resolved';
    }

    // Require confirmation for FREE_TEXT inputs that resolve to STOCK assets
    // This prevents auto-selecting stocks when user types ambiguous text like "bitcoin"
    if (
      inputType === IdentifierType.FREE_TEXT &&
      bestMatch.assetType === MS_ASSET_TYPES.STOCK
    ) {
      this.logger.log(
        `Requiring confirmation for FREE_TEXT input resolving to STOCK: ${bestMatch.morningstarId} (${bestMatch.title})`,
      );
      return 'needs_review';
    }

    if (
      confidence >= this.scorer.getMinConfidence() &&
      bestMatch.morningstarId
    ) {
      return 'resolved';
    }

    if (bestMatch.morningstarId || confidence >= 0.5) {
      return 'needs_review';
    }

    return 'not_found';
  }
}
