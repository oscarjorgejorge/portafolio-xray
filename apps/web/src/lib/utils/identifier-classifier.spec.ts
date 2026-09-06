import { describe, expect, it } from 'vitest';
import {
  IdentifierType,
  classifyIdentifier,
  extractMorningstarIdFromUrl,
  normalizeIdentifierInput,
} from './identifier-classifier';

describe('identifier-classifier', () => {
  describe('normalizeIdentifierInput', () => {
    it('trims and uppercases input', () => {
      expect(normalizeIdentifierInput('  ie00b4l5y983  ')).toBe('IE00B4L5Y983');
    });

    it('collapses multiple spaces', () => {
      expect(normalizeIdentifierInput('fast  emerging  market')).toBe(
        'FAST EMERGING MARKET',
      );
    });
  });

  describe('classifyIdentifier', () => {
    it('classifies valid ISIN', () => {
      expect(classifyIdentifier('IE00B4L5Y983')).toBe(IdentifierType.ISIN);
      expect(classifyIdentifier('LU1206943596')).toBe(IdentifierType.ISIN);
    });

    it('classifies Morningstar IDs', () => {
      expect(classifyIdentifier('0P00015LRD')).toBe(
        IdentifierType.MORNINGSTAR_ID,
      );
      expect(classifyIdentifier('F00000THA5')).toBe(
        IdentifierType.MORNINGSTAR_ID,
      );
    });

    it('classifies pasted Morningstar fund URLs as Morningstar IDs', () => {
      expect(
        classifyIdentifier(
          'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/quote',
        ),
      ).toBe(IdentifierType.MORNINGSTAR_ID);
      expect(
        extractMorningstarIdFromUrl(
          'https://global.morningstar.com/es/inversiones/fondos/0P0001CLDK/cotizacion',
        ),
      ).toBe('0P0001CLDK');
    });

    it('classifies tickers', () => {
      expect(classifyIdentifier('AAPL')).toBe(IdentifierType.TICKER);
      expect(classifyIdentifier('MSFT')).toBe(IdentifierType.TICKER);
    });

    it('classifies free text as name search', () => {
      expect(classifyIdentifier('FAST emerging market')).toBe(
        IdentifierType.FREE_TEXT,
      );
      expect(classifyIdentifier('iShares Core MSCI World')).toBe(
        IdentifierType.FREE_TEXT,
      );
    });

    it('returns FREE_TEXT for empty input', () => {
      expect(classifyIdentifier('')).toBe(IdentifierType.FREE_TEXT);
      expect(classifyIdentifier('   ')).toBe(IdentifierType.FREE_TEXT);
    });
  });
});
