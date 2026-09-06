import { MS_ASSET_TYPES } from './constants';
import {
  extractTickerFromQuotePage,
  isPlausibleTicker,
  isQuoteVerificationValid,
  parseQuoteHeaderIdentity,
} from './quote-page-fields';

describe('quote-page-fields', () => {
  describe('isPlausibleTicker', () => {
    it('accepts real exchange tickers', () => {
      expect(isPlausibleTicker('XSFD')).toBe(true);
      expect(isPlausibleTicker('AMZN')).toBe(true);
      expect(isPlausibleTicker('IWVL')).toBe(true);
    });

    it('rejects type badges and Morningstar IDs', () => {
      expect(isPlausibleTicker('ETF')).toBe(false);
      expect(isPlausibleTicker('UCITS')).toBe(false);
      expect(isPlausibleTicker('FUND')).toBe(false);
      expect(isPlausibleTicker('0P0000AB7T')).toBe(false);
    });
  });

  describe('parseQuoteHeaderIdentity', () => {
    it('reads ETF + ISIN from a global.morningstar.com quote header', () => {
      expect(
        parseQuoteHeaderIdentity(
          'Xtrackers S&P Select Frontier Swap UCITS ETF 1C XSFD ETF LU0328476410 USD',
        ),
      ).toEqual({
        assetType: MS_ASSET_TYPES.ETF,
        isin: 'LU0328476410',
      });
    });

    it('reads a stock header', () => {
      expect(
        parseQuoteHeaderIdentity('Apple Inc STOCK US0378331005 USD'),
      ).toEqual({
        assetType: MS_ASSET_TYPES.STOCK,
        isin: 'US0378331005',
      });
    });
  });

  describe('extractTickerFromQuotePage', () => {
    it('does not treat ETF in the title as a ticker', () => {
      expect(
        extractTickerFromQuotePage({
          url: 'https://global.morningstar.com/en-eu/investments/etfs/0P0000AB7T/quote',
          pageTitle:
            'Xtrackers S&P Select Frontier Swap UCITS ETF 1C XSFD | Morningstar',
        }),
      ).toBe('XSFD');
    });

    it('reads the ticker from a www.morningstar.com ETF URL', () => {
      expect(
        extractTickerFromQuotePage({
          url: 'https://www.morningstar.com/etfs/xlon/xsfd/quote',
          pageTitle: 'Xtrackers S&P Select Frontier Swap UCITS ETF',
        }),
      ).toBe('XSFD');
    });

    it('reads a stock ticker from the start of the title', () => {
      expect(
        extractTickerFromQuotePage({
          url: 'https://global.morningstar.com/en-ca/investments/stocks/0P000000B7/quote',
          pageTitle: 'AMZN Price and Chart | Morningstar',
        }),
      ).toBe('AMZN');
    });
  });

  describe('isQuoteVerificationValid', () => {
    it('accepts an ETF page with a name even when ISIN is missing from HTML', () => {
      expect(
        isQuoteVerificationValid({
          detectedAssetType: MS_ASSET_TYPES.ETF,
          triedAssetType: MS_ASSET_TYPES.STOCK,
          nameFound: 'Xtrackers S&P Select Frontier Swap UCITS ETF 1C XSFD',
        }),
      ).toBe(true);
    });

    it('does not treat a detected ETF as a stock-only match', () => {
      expect(
        isQuoteVerificationValid({
          triedAssetType: MS_ASSET_TYPES.STOCK,
          detectedAssetType: MS_ASSET_TYPES.ETF,
          nameFound: 'Xtrackers S&P Select Frontier Swap UCITS ETF 1C XSFD',
        }),
      ).toBe(true);
    });

    it('still accepts a stock with only a name', () => {
      expect(
        isQuoteVerificationValid({
          triedAssetType: MS_ASSET_TYPES.STOCK,
          detectedAssetType: MS_ASSET_TYPES.STOCK,
          nameFound: 'SoFi Technologies Inc Ordinary Shares',
        }),
      ).toBe(true);
    });

    it('rejects unavailable markets', () => {
      expect(
        isQuoteVerificationValid({
          marketNotAvailable: true,
          isinFound: 'LU0328476410',
          nameFound: 'Xtrackers',
        }),
      ).toBe(false);
    });
  });
});
