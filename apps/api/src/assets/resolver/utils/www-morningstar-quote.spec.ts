import { MS_ASSET_TYPES } from './constants';
import {
  buildWwwMorningstarTickerQuoteUrl,
  detectAssetTypeFromMorningstarUrl,
  isAcceptableWwwQuoteIdentity,
  morningstarMicsForYahooQuote,
  parseWwwMorningstarQuoteHtml,
  parseWwwMorningstarSearchHtml,
  wwwTickerQuoteTargets,
  yahooSymbolToTicker,
} from './www-morningstar-quote';

describe('www-morningstar-quote', () => {
  describe('yahooSymbolToTicker', () => {
    it('should strip the Yahoo exchange suffix', () => {
      expect(yahooSymbolToTicker('IWVL.L')).toBe('IWVL');
      expect(yahooSymbolToTicker('AMZN')).toBe('AMZN');
    });
  });

  describe('morningstarMicsForYahooQuote', () => {
    it('should map LSE suffixes to xlon', () => {
      expect(morningstarMicsForYahooQuote('IWVL.L', 'LSE')).toEqual(['xlon']);
    });

    it('should map NASDAQ to xnas', () => {
      expect(morningstarMicsForYahooQuote('AMZN', 'NMS')).toEqual(['xnas']);
    });

    it('should try US exchanges when Yahoo has no MIC', () => {
      expect(morningstarMicsForYahooQuote('AMZN')).toEqual([
        'xnas',
        'xnys',
        'arcx',
      ]);
    });
  });

  describe('wwwTickerQuoteTargets', () => {
    it('should build the NASDAQ stock quote URL for AMZN', () => {
      expect(
        wwwTickerQuoteTargets({
          symbol: 'AMZN',
          exchange: 'NMS',
          quoteType: 'EQUITY',
        }),
      ).toEqual([
        {
          ticker: 'AMZN',
          mic: 'xnas',
          assetType: MS_ASSET_TYPES.STOCK,
          url: 'https://www.morningstar.com/stocks/xnas/amzn/quote',
        },
      ]);
    });

    it('should build the LSE ETF quote URL', () => {
      expect(
        wwwTickerQuoteTargets({
          symbol: 'IWVL.L',
          exchange: 'LSE',
          quoteType: 'ETF',
        })[0],
      ).toMatchObject({
        url: 'https://www.morningstar.com/etfs/xlon/iwvl/quote',
        assetType: MS_ASSET_TYPES.ETF,
      });
    });
  });

  describe('parseWwwMorningstarQuoteHtml', () => {
    it('should read the stock performance ID and US ISIN', () => {
      const html = `
        <title>Amazon (AMZN) Stock Price &amp; News - NASDAQ: AMZN | Morningstar</title>
        <script>window.__NUXT__={"byId":"0P000000B7","performanceId":"0P000000B7","isin":"US0231351067"}</script>
      `;
      const identity = parseWwwMorningstarQuoteHtml(
        html,
        'https://www.morningstar.com/stocks/xnas/amzn/quote',
      );
      expect(identity).toMatchObject({
        morningstarId: '0P000000B7',
        isin: 'US0231351067',
        ticker: 'AMZN',
        assetType: MS_ASSET_TYPES.STOCK,
      });
      expect(identity?.name).toContain('Amazon');
    });

    it('should ignore CSS keys like yearLowPrice that pass a Luhn checksum', () => {
      const html = `
        <script>
          {"yearLowPrice":12.3,"byId":"0P000000B7","isin":"US0231351067"}
        </script>
      `;
      const identity = parseWwwMorningstarQuoteHtml(
        html,
        'https://www.morningstar.com/stocks/xnas/amzn/quote',
      );
      expect(identity?.isin).toBe('US0231351067');
      expect(identity?.isin).not.toBe('YEARLOWPRICE');
    });

    it('should read an ETF share-class ID', () => {
      const html = `
        <title>IWVL - iShares Edge MSCI Wld Val Fctr ETF $Acc</title>
        <script>{"performanceId":"0P00014E87","byId":"F00000UJ69","isin":"IE00BP3QZB59"}</script>
      `;
      const identity = parseWwwMorningstarQuoteHtml(
        html,
        'https://www.morningstar.com/etfs/xlon/iwvl/quote',
      );
      expect(identity).toMatchObject({
        morningstarId: '0P00014E87',
        shareClassId: 'F00000UJ69',
        isin: 'IE00BP3QZB59',
        assetType: MS_ASSET_TYPES.ETF,
      });
    });
  });

  describe('parseWwwMorningstarSearchHtml', () => {
    it('should prefer quote URLs near the queried ISIN', () => {
      const html = `
        <a href="https://www.morningstar.com/stocks/xnas/amzn/quote">Amazon</a>
        <div>IE00BP3QZB59</div>
        <a href="https://www.morningstar.com/etfs/xlon/iwvl/quote">IWVL</a>
      `;
      expect(parseWwwMorningstarSearchHtml(html, 'IE00BP3QZB59')[0]).toBe(
        'https://www.morningstar.com/etfs/xlon/iwvl/quote',
      );
    });
  });

  describe('isAcceptableWwwQuoteIdentity', () => {
    it('should require the page ISIN to match an ISIN query', () => {
      expect(
        isAcceptableWwwQuoteIdentity(
          {
            morningstarId: '0P00014E87',
            isin: 'IE00BP3QZB59',
            assetType: MS_ASSET_TYPES.ETF,
            url: 'https://www.morningstar.com/etfs/xlon/iwvl/quote',
          },
          'IE00BP3QZB59',
        ),
      ).toBe(true);
      expect(
        isAcceptableWwwQuoteIdentity(
          {
            morningstarId: '0P0000AB7T',
            isin: 'LU0000000000',
            assetType: MS_ASSET_TYPES.ETF,
            url: 'https://www.morningstar.com/etfs/xlon/xsfd/quote',
          },
          'LU0328476410',
        ),
      ).toBe(false);
    });
  });

  it('should build ticker quote URLs', () => {
    expect(
      buildWwwMorningstarTickerQuoteUrl(MS_ASSET_TYPES.STOCK, 'xnas', 'AMZN'),
    ).toBe('https://www.morningstar.com/stocks/xnas/amzn/quote');
  });

  it('should detect asset type from URL', () => {
    expect(
      detectAssetTypeFromMorningstarUrl(
        'https://global.morningstar.com/en-ca/investments/stocks/0P000000B7/quote',
      ),
    ).toBe(MS_ASSET_TYPES.STOCK);
    expect(
      detectAssetTypeFromMorningstarUrl(
        'https://global.morningstar.com/en-gb/investments/etfs/0P00014E87/quote',
      ),
    ).toBe(MS_ASSET_TYPES.ETF);
  });
});
