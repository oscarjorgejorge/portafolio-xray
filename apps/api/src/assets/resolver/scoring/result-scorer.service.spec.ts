import { ResultScorerService } from './result-scorer.service';
import { SearchResult, ScoredResult } from '../resolver.types';
import { IdentifierType } from '../../../common/utils/identifier-classifier';
import { SCORE_WEIGHTS, MAX_SCORES, MS_ASSET_TYPES } from '../utils/constants';

describe('ResultScorerService', () => {
  let service: ResultScorerService;

  beforeEach(() => {
    service = new ResultScorerService();
  });

  describe('scoreResult', () => {
    const createSearchResult = (
      overrides: Partial<SearchResult> = {},
    ): SearchResult => ({
      url: 'https://www.morningstar.es/es/funds/snapshot/snapshot.aspx?id=F00000THA5',
      title: 'Vanguard Global Stock Index Fund',
      snippet: 'A low-cost global equity index fund',
      morningstarId: 'F00000THA5',
      domain: 'morningstar.es',
      ...overrides,
    });

    describe('Morningstar ID exact match', () => {
      it('should give maximum score for exact Morningstar ID match', () => {
        const result = createSearchResult({ morningstarId: '0P0000YXJO' });
        const scored = service.scoreResult(
          result,
          '0P0000YXJO',
          IdentifierType.MORNINGSTAR_ID,
        );

        expect(scored.scoreBreakdown.morningstarIdMatch).toBe(
          SCORE_WEIGHTS.MORNINGSTAR_ID_EXACT_MATCH,
        );
      });

      it('should not give Morningstar ID match bonus for different IDs', () => {
        const result = createSearchResult({ morningstarId: 'F00000THA5' });
        const scored = service.scoreResult(
          result,
          '0P0000YXJO',
          IdentifierType.MORNINGSTAR_ID,
        );

        expect(scored.scoreBreakdown.morningstarIdMatch).toBe(0);
      });

      it('should handle case-insensitive Morningstar ID matching', () => {
        const result = createSearchResult({ morningstarId: '0p0000yxjo' });
        const scored = service.scoreResult(
          result,
          '0P0000YXJO',
          IdentifierType.MORNINGSTAR_ID,
        );

        expect(scored.scoreBreakdown.morningstarIdMatch).toBe(
          SCORE_WEIGHTS.MORNINGSTAR_ID_EXACT_MATCH,
        );
      });
    });

    describe('ISIN match', () => {
      it('should give ISIN match bonus when ISIN appears in result', () => {
        const result = createSearchResult({
          title: 'Fund IE00B4L5Y983',
          snippet: 'Contains ISIN IE00B4L5Y983',
        });
        const scored = service.scoreResult(
          result,
          'IE00B4L5Y983',
          IdentifierType.ISIN,
        );

        expect(scored.scoreBreakdown.isinMatch).toBe(SCORE_WEIGHTS.ISIN_MATCH);
      });

      it('should not give ISIN match bonus when ISIN not in result', () => {
        const result = createSearchResult();
        const scored = service.scoreResult(
          result,
          'IE00B4L5Y983',
          IdentifierType.ISIN,
        );

        expect(scored.scoreBreakdown.isinMatch).toBe(0);
      });

      it('should not check for ISIN match when input is not ISIN type', () => {
        const result = createSearchResult({
          title: 'Fund IE00B4L5Y983',
        });
        const scored = service.scoreResult(
          result,
          'AAPL',
          IdentifierType.TICKER,
        );

        expect(scored.scoreBreakdown.isinMatch).toBe(0);
      });
    });

    describe('Ticker match', () => {
      it('should give ticker match bonus for exact ticker in title', () => {
        const result = createSearchResult({
          title: 'Apple Inc AAPL Stock',
          ticker: 'AAPL',
        });
        const scored = service.scoreResult(
          result,
          'AAPL',
          IdentifierType.TICKER,
        );

        expect(scored.scoreBreakdown.tickerMatch).toBe(
          SCORE_WEIGHTS.TICKER_MATCH,
        );
      });

      it('should give ticker match bonus when ticker field matches', () => {
        const result = createSearchResult({
          title: 'Apple Inc',
          ticker: 'AAPL',
        });
        const scored = service.scoreResult(
          result,
          'AAPL',
          IdentifierType.TICKER,
        );

        expect(scored.scoreBreakdown.tickerMatch).toBe(
          SCORE_WEIGHTS.TICKER_MATCH,
        );
      });

      it('should not give ticker match for partial matches', () => {
        const result = createSearchResult({
          title: 'AAPLX Fund',
          ticker: 'AAPLX',
        });
        const scored = service.scoreResult(
          result,
          'AAPL',
          IdentifierType.TICKER,
        );

        expect(scored.scoreBreakdown.tickerMatch).toBe(0);
      });
    });

    describe('Name match (FREE_TEXT)', () => {
      it('should give partial score for partial name match', () => {
        const result = createSearchResult({
          title: 'Vanguard Global Stock Index Fund',
        });
        const scored = service.scoreResult(
          result,
          'Vanguard Global',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.nameMatch).toBeGreaterThan(0);
        expect(scored.scoreBreakdown.nameMatch).toBeLessThanOrEqual(
          SCORE_WEIGHTS.NAME_MATCH_MAX,
        );
      });

      it('should give maximum name score for full match', () => {
        const result = createSearchResult({
          title: 'VANGUARD GLOBAL STOCK INDEX FUND',
        });
        const scored = service.scoreResult(
          result,
          'Vanguard Global Stock Index Fund',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.nameMatch).toBe(
          SCORE_WEIGHTS.NAME_MATCH_MAX,
        );
      });

      it('should ignore short words (<=3 chars) in name matching', () => {
        const result = createSearchResult({
          title: 'The Fund',
        });
        const scored = service.scoreResult(
          result,
          'The', // Only 3 chars, should be ignored
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.nameMatch).toBe(0);
      });

      it('should give 0 for no word matches', () => {
        const result = createSearchResult({
          title: 'iShares Core S&P 500',
        });
        const scored = service.scoreResult(
          result,
          'Fidelity European',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.nameMatch).toBe(0);
      });
    });

    describe('Morningstar domain bonus', () => {
      it('should give domain bonus for morningstar.es', () => {
        const result = createSearchResult({ domain: 'morningstar.es' });
        const scored = service.scoreResult(
          result,
          'test',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.morningstarDomain).toBe(
          SCORE_WEIGHTS.MORNINGSTAR_DOMAIN,
        );
      });

      it('should give domain bonus for morningstar.com', () => {
        const result = createSearchResult({ domain: 'morningstar.com' });
        const scored = service.scoreResult(
          result,
          'test',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.morningstarDomain).toBe(
          SCORE_WEIGHTS.MORNINGSTAR_DOMAIN,
        );
      });

      it('should give domain bonus for global.morningstar.com', () => {
        const result = createSearchResult({ domain: 'global.morningstar.com' });
        const scored = service.scoreResult(
          result,
          'test',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.morningstarDomain).toBe(
          SCORE_WEIGHTS.MORNINGSTAR_DOMAIN,
        );
      });

      it('should not give domain bonus for other domains', () => {
        const result = createSearchResult({ domain: 'google.com' });
        const scored = service.scoreResult(
          result,
          'test',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.morningstarDomain).toBe(0);
      });
    });

    describe('Has Morningstar ID bonus', () => {
      it('should give bonus when result has Morningstar ID', () => {
        const result = createSearchResult({ morningstarId: 'F00000THA5' });
        const scored = service.scoreResult(
          result,
          'test',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.typeMatch).toBeGreaterThanOrEqual(
          SCORE_WEIGHTS.HAS_MORNINGSTAR_ID,
        );
      });

      it('should not give bonus when result has no Morningstar ID', () => {
        const result = createSearchResult({ morningstarId: null });
        const scored = service.scoreResult(
          result,
          'test',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.typeMatch).toBe(0);
      });
    });

    describe('Fund F ID bonus', () => {
      it('should give extra bonus for fund with F-prefixed ID', () => {
        const result = createSearchResult({
          morningstarId: 'F00000THA5',
          assetType: MS_ASSET_TYPES.FUND,
        });
        const scored = service.scoreResult(
          result,
          'test',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.typeMatch).toBe(
          SCORE_WEIGHTS.HAS_MORNINGSTAR_ID + SCORE_WEIGHTS.FUND_F_ID_BONUS,
        );
      });

      it('should not give F ID bonus for non-fund assets', () => {
        const result = createSearchResult({
          morningstarId: 'F00000THA5',
          assetType: MS_ASSET_TYPES.ETF,
        });
        const scored = service.scoreResult(
          result,
          'test',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.typeMatch).toBe(
          SCORE_WEIGHTS.HAS_MORNINGSTAR_ID,
        );
      });

      it('should not give F ID bonus for 0P-prefixed IDs', () => {
        const result = createSearchResult({
          morningstarId: '0P0000YXJO',
          assetType: MS_ASSET_TYPES.FUND,
        });
        const scored = service.scoreResult(
          result,
          'test',
          IdentifierType.FREE_TEXT,
        );

        expect(scored.scoreBreakdown.typeMatch).toBe(
          SCORE_WEIGHTS.HAS_MORNINGSTAR_ID,
        );
      });
    });

    describe('Total score calculation', () => {
      it('should sum all score components correctly', () => {
        const result = createSearchResult({
          morningstarId: '0P0000YXJO',
          domain: 'morningstar.es',
        });
        const scored = service.scoreResult(
          result,
          '0P0000YXJO',
          IdentifierType.MORNINGSTAR_ID,
        );

        const expectedScore =
          SCORE_WEIGHTS.MORNINGSTAR_ID_EXACT_MATCH +
          SCORE_WEIGHTS.MORNINGSTAR_DOMAIN +
          SCORE_WEIGHTS.HAS_MORNINGSTAR_ID;

        expect(scored.score).toBe(expectedScore);
      });
    });
  });

  describe('scoreAndSortResults', () => {
    it('should sort results by score in descending order', () => {
      const results: SearchResult[] = [
        {
          url: 'https://other.com',
          title: 'Low score result',
          snippet: '',
          morningstarId: null,
          domain: 'other.com',
        },
        {
          url: 'https://morningstar.es',
          title: 'High score result',
          snippet: '',
          morningstarId: '0P0000YXJO',
          domain: 'morningstar.es',
        },
      ];

      const scored = service.scoreAndSortResults(
        results,
        'test',
        IdentifierType.FREE_TEXT,
      );

      expect(scored[0].morningstarId).toBe('0P0000YXJO');
      expect(scored[0].score).toBeGreaterThan(scored[1].score);
    });

    it('should return empty array for empty input', () => {
      const scored = service.scoreAndSortResults(
        [],
        'test',
        IdentifierType.FREE_TEXT,
      );

      expect(scored).toEqual([]);
    });
  });

  describe('prioritizeFundResults', () => {
    const createScoredResult = (
      overrides: Partial<ScoredResult> = {},
    ): ScoredResult => ({
      url: '',
      title: 'Test Fund',
      snippet: '',
      morningstarId: '0P0000YXJO',
      domain: 'morningstar.es',
      assetType: MS_ASSET_TYPES.FUND,
      score: 50,
      scoreBreakdown: {
        isinMatch: 0,
        tickerMatch: 0,
        nameMatch: 0,
        morningstarDomain: 20,
        typeMatch: 10,
        morningstarIdMatch: 0,
      },
      ...overrides,
    });

    it('should move F-prefixed ID to top when same name exists', () => {
      const results: ScoredResult[] = [
        createScoredResult({
          title: 'Vanguard Fund',
          morningstarId: '0P0000YXJO',
          score: 60,
        }),
        createScoredResult({
          title: 'Vanguard Fund',
          morningstarId: 'F00000THA5',
          score: 55,
        }),
      ];

      const prioritized = service.prioritizeFundResults(results);

      expect(prioritized[0].morningstarId).toBe('F00000THA5');
    });

    it('should not reorder when F-prefixed result is already first', () => {
      const results: ScoredResult[] = [
        createScoredResult({
          title: 'Vanguard Fund',
          morningstarId: 'F00000THA5',
          score: 60,
        }),
        createScoredResult({
          title: 'Vanguard Fund',
          morningstarId: '0P0000YXJO',
          score: 55,
        }),
      ];

      const prioritized = service.prioritizeFundResults(results);

      expect(prioritized[0].morningstarId).toBe('F00000THA5');
    });

    it('should not reorder when names are different', () => {
      const results: ScoredResult[] = [
        createScoredResult({
          title: 'Vanguard Fund A',
          morningstarId: '0P0000YXJO',
          score: 60,
        }),
        createScoredResult({
          title: 'Fidelity Fund B',
          morningstarId: 'F00000THA5',
          score: 55,
        }),
      ];

      const prioritized = service.prioritizeFundResults(results);

      expect(prioritized[0].morningstarId).toBe('0P0000YXJO');
    });

    it('should return single result unchanged', () => {
      const results: ScoredResult[] = [
        createScoredResult({ morningstarId: '0P0000YXJO' }),
      ];

      const prioritized = service.prioritizeFundResults(results);

      expect(prioritized).toEqual(results);
    });

    it('should return empty array unchanged', () => {
      const prioritized = service.prioritizeFundResults([]);

      expect(prioritized).toEqual([]);
    });

    it('should handle ETFs the same as funds', () => {
      const results: ScoredResult[] = [
        createScoredResult({
          title: 'iShares ETF',
          morningstarId: '0P0000YXJO',
          assetType: MS_ASSET_TYPES.ETF,
          score: 60,
        }),
        createScoredResult({
          title: 'iShares ETF',
          morningstarId: 'F00000THA5',
          assetType: MS_ASSET_TYPES.ETF,
          score: 55,
        }),
      ];

      const prioritized = service.prioritizeFundResults(results);

      expect(prioritized[0].morningstarId).toBe('F00000THA5');
    });

    it('should not prioritize for stock assets', () => {
      const results: ScoredResult[] = [
        createScoredResult({
          title: 'Apple Stock',
          morningstarId: '0P0000YXJO',
          assetType: MS_ASSET_TYPES.STOCK,
          score: 60,
        }),
        createScoredResult({
          title: 'Apple Stock',
          morningstarId: 'F00000THA5',
          assetType: MS_ASSET_TYPES.STOCK,
          score: 55,
        }),
      ];

      const prioritized = service.prioritizeFundResults(results);

      expect(prioritized[0].morningstarId).toBe('0P0000YXJO');
    });
  });

  describe('calculateConfidence', () => {
    const createScoredResult = (score: number): ScoredResult => ({
      url: '',
      title: '',
      snippet: '',
      morningstarId: 'F00000THA5',
      domain: '',
      score,
      scoreBreakdown: {
        isinMatch: 0,
        tickerMatch: 0,
        nameMatch: 0,
        morningstarDomain: 0,
        typeMatch: 0,
        morningstarIdMatch: 0,
      },
    });

    it('should return 1.0 for verified Morningstar ID match', () => {
      const result = createScoredResult(MAX_SCORES.VERIFIED);
      const confidence = service.calculateConfidence(
        result,
        IdentifierType.MORNINGSTAR_ID,
        true,
      );

      expect(confidence).toBe(1);
    });

    it('should normalize score based on input type (MORNINGSTAR_ID)', () => {
      const result = createScoredResult(65);
      const confidence = service.calculateConfidence(
        result,
        IdentifierType.MORNINGSTAR_ID,
        false,
      );

      expect(confidence).toBeCloseTo(65 / MAX_SCORES.MORNINGSTAR_ID);
    });

    it('should normalize score based on input type (TICKER)', () => {
      const result = createScoredResult(35);
      const confidence = service.calculateConfidence(
        result,
        IdentifierType.TICKER,
        false,
      );

      expect(confidence).toBeCloseTo(35 / MAX_SCORES.TICKER);
    });

    it('should normalize score based on input type (FREE_TEXT)', () => {
      const result = createScoredResult(40);
      const confidence = service.calculateConfidence(
        result,
        IdentifierType.FREE_TEXT,
        false,
      );

      expect(confidence).toBeCloseTo(40 / MAX_SCORES.DEFAULT);
    });

    it('should cap confidence at 1.0 for very high scores', () => {
      const result = createScoredResult(200);
      const confidence = service.calculateConfidence(
        result,
        IdentifierType.FREE_TEXT,
        false,
      );

      expect(confidence).toBe(1);
    });
  });

  describe('getMinConfidence', () => {
    it('should return the configured minimum confidence threshold', () => {
      const minConfidence = service.getMinConfidence();

      expect(minConfidence).toBe(0.7);
    });
  });

  describe('getVerificationBonus', () => {
    it('should return the verification bonus score', () => {
      const bonus = service.getVerificationBonus();

      expect(bonus).toBe(SCORE_WEIGHTS.VERIFICATION_BONUS);
    });
  });
});
