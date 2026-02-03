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

// Search strategies
import { ApiSearchStrategy } from './strategies/api-search.strategy';
import { HtmlScrapeStrategy } from './strategies/html-scrape.strategy';
import { GlobalSearchStrategy } from './strategies/global-search.strategy';
import { DuckDuckGoStrategy } from './strategies/duckduckgo.strategy';

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
    private readonly scorer: ResultScorerService,
    private readonly verifier: PageVerifierService,
  ) {}

  /**
   * Search using all strategies and combine results
   */
  private async searchAll(query: string): Promise<SearchResult[]> {
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
    const normalizedInput = IdentifierClassifier.normalizeInput(input);
    const inputType = IdentifierClassifier.classify(normalizedInput);

    this.logger.log(`Resolving: ${input} (type: ${inputType})`);

    // Search using all strategies
    const searchResults = await this.searchAll(normalizedInput);

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

    // Handle different input types
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
      const result =
        await this.handleDirectMorningstarIdResolution(normalizedInput);
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

    if (verification?.nameFound) {
      bestMatch.title = verification.nameFound;
    }

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
  ): Promise<{
    bestMatch: ScoredResult;
    status: 'resolved' | 'needs_review' | 'not_found';
    confidence: number;
    verification?: VerificationResult;
  } | null> {
    this.logger.log(
      `[DIRECT] No search results for Morningstar ID ${normalizedInput}, trying direct verification...`,
    );

    const assetTypesToTry: MorningstarAssetType[] = [
      MS_ASSET_TYPES.FUND,
      MS_ASSET_TYPES.ETF,
      MS_ASSET_TYPES.STOCK,
    ];
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
      const syntheticMatch: ScoredResult = {
        url: workingUrl,
        title: verification.nameFound || normalizedInput,
        snippet: `Direct resolution | Tipo: ${foundAssetType}${marketId ? ` | Market: ${marketId.toUpperCase()}` : ''}`,
        morningstarId: normalizedInput,
        domain: 'global.morningstar.com',
        isin: verification.isinFound || undefined,
        assetType: foundAssetType,
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
        `[DIRECT] ${foundAssetType} resolved via direct verification: ${normalizedInput}${verification.isinFound ? ` (ISIN: ${verification.isinFound})` : ''}${marketId ? ` (market: ${marketId})` : ''}`,
      );

      return {
        bestMatch: syntheticMatch,
        status: 'resolved',
        confidence: 1.0,
        verification,
      };
    }

    return null;
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
    const { verification, workingUrl, marketId, detectedAssetType } =
      await this.verifier.verifyFundPageWithFallback(
        bestMatch.morningstarId!,
        normalizedInput,
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

    if (verification.verified) {
      bestMatch.score += SCORE_WEIGHTS.VERIFICATION_BONUS;
      bestMatch.scoreBreakdown.isinMatch = SCORE_WEIGHTS.VERIFICATION_BONUS;

      if (verification.nameFound) {
        bestMatch.title = verification.nameFound;
      }

      scoredResults = scoredResults.sort((a, b) => b.score - a.score);
    }

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
      await this.verifier.verifyFundPageWithFallback(
        bestMatch.morningstarId!,
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

    if (verification?.nameFound && !bestMatch.title) {
      bestMatch.title = verification.nameFound;
    }

    return { bestMatch, verification };
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
