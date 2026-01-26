import { Injectable } from '@nestjs/common';
import {
  SearchResult,
  ScoredResult,
  InputType,
  ResolverConfig,
} from '../resolver.types';
import { normalizeInput } from '../utils/input-normalizer';
import {
  DEFAULT_RESOLVER_CONFIG,
  SCORE_WEIGHTS,
  MAX_SCORES,
  MIN_WORD_LENGTH_FOR_MATCHING,
} from '../utils/constants';

/**
 * Service responsible for scoring search results based on match quality
 * Uses configurable weights from constants for maintainability
 */
@Injectable()
export class ResultScorerService {
  private readonly config: ResolverConfig = DEFAULT_RESOLVER_CONFIG;

  /**
   * Score a search result based on how well it matches the original input
   */
  scoreResult(
    result: SearchResult,
    originalInput: string,
    inputType: InputType,
  ): ScoredResult {
    const breakdown = {
      isinMatch: 0,
      tickerMatch: 0,
      nameMatch: 0,
      morningstarDomain: 0,
      typeMatch: 0,
      morningstarIdMatch: 0,
    };

    const textToSearch =
      `${result.title} ${result.snippet} ${result.url}`.toUpperCase();
    const normalizedInput = normalizeInput(originalInput);

    // Exact Morningstar ID match (highest priority)
    if (
      inputType === 'MORNINGSTAR_ID' &&
      result.morningstarId &&
      result.morningstarId.toUpperCase() === normalizedInput
    ) {
      breakdown.morningstarIdMatch = SCORE_WEIGHTS.MORNINGSTAR_ID_EXACT_MATCH;
    }

    // ISIN appears in result
    if (inputType === 'ISIN' && textToSearch.includes(normalizedInput)) {
      breakdown.isinMatch = SCORE_WEIGHTS.ISIN_MATCH;
    }

    // Ticker matches exactly
    if (inputType === 'TICKER') {
      const tickerPattern = new RegExp(`\\b${normalizedInput}\\b`, 'i');
      const tickerValue =
        typeof result.ticker === 'string' ? result.ticker.toUpperCase() : '';
      if (tickerPattern.test(result.title) || tickerValue === normalizedInput) {
        breakdown.tickerMatch = SCORE_WEIGHTS.TICKER_MATCH;
      }
    }

    // Partial name match (FREE_TEXT) - scaled by match percentage
    if (inputType === 'FREE_TEXT') {
      const words = normalizedInput
        .split(' ')
        .filter((w) => w.length > MIN_WORD_LENGTH_FOR_MATCHING);
      const matchedWords = words.filter((w) => textToSearch.includes(w));
      breakdown.nameMatch = Math.round(
        (matchedWords.length / Math.max(words.length, 1)) *
          SCORE_WEIGHTS.NAME_MATCH_MAX,
      );
    }

    // Morningstar domain bonus
    if (
      this.config.domains.some((d) =>
        result.domain.includes(d.replace('www.', '')),
      )
    ) {
      breakdown.morningstarDomain = SCORE_WEIGHTS.MORNINGSTAR_DOMAIN;
    }

    // Valid Morningstar ID bonus
    if (result.morningstarId) {
      breakdown.typeMatch = SCORE_WEIGHTS.HAS_MORNINGSTAR_ID;
    }

    // Fund IDs starting with "F" bonus (preferred format for funds)
    if (
      result.morningstarId &&
      result.assetType === 'Fondo' &&
      result.morningstarId.toUpperCase().startsWith('F')
    ) {
      breakdown.typeMatch += SCORE_WEIGHTS.FUND_F_ID_BONUS;
    }

    const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);

    return {
      ...result,
      score: totalScore,
      scoreBreakdown: breakdown,
    };
  }

  /**
   * Score multiple results and sort by score (highest first)
   */
  scoreAndSortResults(
    results: SearchResult[],
    originalInput: string,
    inputType: InputType,
  ): ScoredResult[] {
    return results
      .map((r) => this.scoreResult(r, originalInput, inputType))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Prioritize results with same name, preferring "F" IDs for funds
   */
  prioritizeFundResults(scoredResults: ScoredResult[]): ScoredResult[] {
    if (scoredResults.length <= 1) return scoredResults;

    const firstResult = scoredResults[0];
    const isFund =
      firstResult?.assetType === 'Fondo' || firstResult?.assetType === 'ETF';

    if (!isFund || !firstResult?.title) return scoredResults;

    // Find all results with the same name (normalized)
    const normalizedTitle = normalizeInput(firstResult.title);
    const sameNameResults = scoredResults.filter(
      (r) => r.title && normalizeInput(r.title) === normalizedTitle,
    );

    // If multiple results have the same name, prefer the one with "F" ID
    if (sameNameResults.length > 1) {
      const fIdResult = sameNameResults.find(
        (r) => r.morningstarId && r.morningstarId.toUpperCase().startsWith('F'),
      );

      if (fIdResult && fIdResult !== firstResult) {
        // Move the "F" ID result to the top
        return [fIdResult, ...scoredResults.filter((r) => r !== fIdResult)];
      }
    }

    return scoredResults;
  }

  /**
   * Calculate confidence score based on the best match
   * Normalizes the score to a 0-1 range based on input type
   */
  calculateConfidence(
    bestMatch: ScoredResult,
    inputType: InputType,
    verified: boolean,
  ): number {
    const maxScore = this.getMaxScoreForInputType(inputType, verified);
    return Math.min(bestMatch.score / maxScore, 1);
  }

  /**
   * Get the maximum possible score for an input type
   * Used for confidence normalization
   */
  private getMaxScoreForInputType(
    inputType: InputType,
    verified: boolean,
  ): number {
    if (verified) {
      return MAX_SCORES.VERIFIED;
    }

    switch (inputType) {
      case 'MORNINGSTAR_ID':
        return MAX_SCORES.MORNINGSTAR_ID;
      case 'TICKER':
        return MAX_SCORES.TICKER;
      default:
        return MAX_SCORES.DEFAULT;
    }
  }

  /**
   * Get the minimum confidence threshold from config
   */
  getMinConfidence(): number {
    return this.config.minConfidence;
  }

  /**
   * Get the verification bonus score (for external use)
   */
  getVerificationBonus(): number {
    return SCORE_WEIGHTS.VERIFICATION_BONUS;
  }
}
