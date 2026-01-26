import { Injectable } from '@nestjs/common';
import {
  SearchResult,
  ScoredResult,
  InputType,
  ResolverConfig,
} from '../resolver.types';
import { normalizeInput } from '../utils/input-normalizer';
import { DEFAULT_RESOLVER_CONFIG } from '../utils/constants';

/**
 * Service responsible for scoring search results based on match quality
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

    // +100 if Morningstar ID matches exactly (highest priority)
    if (
      inputType === 'MORNINGSTAR_ID' &&
      result.morningstarId &&
      result.morningstarId.toUpperCase() === normalizedInput
    ) {
      breakdown.morningstarIdMatch = 100;
    }

    // +50 if ISIN appears in result
    if (inputType === 'ISIN' && textToSearch.includes(normalizedInput)) {
      breakdown.isinMatch = 50;
    }

    // +40 if ticker matches exactly
    if (inputType === 'TICKER') {
      const tickerPattern = new RegExp(`\\b${normalizedInput}\\b`, 'i');
      const tickerValue =
        typeof result.ticker === 'string' ? result.ticker.toUpperCase() : '';
      if (tickerPattern.test(result.title) || tickerValue === normalizedInput) {
        breakdown.tickerMatch = 40;
      }
    }

    // +30 for partial name match (FREE_TEXT)
    if (inputType === 'FREE_TEXT') {
      const words = normalizedInput.split(' ').filter((w) => w.length > 3);
      const matchedWords = words.filter((w) => textToSearch.includes(w));
      breakdown.nameMatch = Math.round(
        (matchedWords.length / Math.max(words.length, 1)) * 30,
      );
    }

    // +20 for Morningstar domain
    if (
      this.config.domains.some((d) =>
        result.domain.includes(d.replace('www.', '')),
      )
    ) {
      breakdown.morningstarDomain = 20;
    }

    // +10 for valid Morningstar ID
    if (result.morningstarId) {
      breakdown.typeMatch = 10;
    }

    // +15 bonus for fund IDs starting with "F" (preferred format for funds)
    if (
      result.morningstarId &&
      result.assetType === 'Fondo' &&
      result.morningstarId.toUpperCase().startsWith('F')
    ) {
      breakdown.typeMatch += 15;
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
   */
  calculateConfidence(
    bestMatch: ScoredResult,
    inputType: InputType,
    verified: boolean,
  ): number {
    const maxScore = verified
      ? 130
      : inputType === 'MORNINGSTAR_ID'
        ? 130
        : inputType === 'TICKER'
          ? 70
          : 80;

    return Math.min(bestMatch.score / maxScore, 1);
  }

  /**
   * Get the minimum confidence threshold from config
   */
  getMinConfidence(): number {
    return this.config.minConfidence;
  }
}
