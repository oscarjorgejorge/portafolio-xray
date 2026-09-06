import {
  buildGlobalSearchUrl,
  buildMorningstarUrl,
  buildWwwMorningstarQuoteUrl,
  buildYahooFinanceSearchUrl,
  canonicalMorningstarQuoteUrl,
  shareClassIdLookupUrls,
} from './url-builder';
import { MS_ASSET_TYPES } from './constants';

describe('url-builder', () => {
  it('should build the Spanish cotizacion URL by default', () => {
    expect(buildMorningstarUrl('0P0001CLDK', MS_ASSET_TYPES.FUND)).toBe(
      'https://global.morningstar.com/es/inversiones/fondos/0P0001CLDK/cotizacion',
    );
  });

  it('should build the en-eu quote URL without a marketID', () => {
    expect(buildMorningstarUrl('0P0001CLDK', MS_ASSET_TYPES.FUND, 'eu')).toBe(
      'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/quote',
    );
  });

  it('should search the ISIN country when requested', () => {
    expect(
      buildGlobalSearchUrl('IE00BYX5NX33', {
        languageId: 'en-GB',
        countryId: 'IE',
      }),
    ).toContain('countryId=IE');
  });

  it('should keep en-ca stock quote URLs on the Canadian locale', () => {
    expect(
      canonicalMorningstarQuoteUrl(
        'https://global.morningstar.com/en-ca/investments/stocks/0P000000B7/quote',
        '0P000000B7',
      ),
    ).toBe(
      'https://global.morningstar.com/en-ca/investments/stocks/0P000000B7/quote',
    );
  });

  it('should keep en-gb ETF quote URLs on the UK locale', () => {
    expect(
      canonicalMorningstarQuoteUrl(
        'https://global.morningstar.com/en-gb/investments/etfs/0P00014E87/chart',
        '0P00014E87',
      ),
    ).toBe(
      'https://global.morningstar.com/en-gb/investments/etfs/0P00014E87/quote',
    );
  });

  it('should rewrite en-eu quote, chart and uppercased URLs to the quote page', () => {
    const quote =
      'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/quote';
    expect(
      canonicalMorningstarQuoteUrl(
        'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/quote',
        '0P0001CLDK',
      ),
    ).toBe(quote);
    expect(
      canonicalMorningstarQuoteUrl(
        'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/chart',
        '0P0001CLDK',
      ),
    ).toBe(quote);
    expect(
      canonicalMorningstarQuoteUrl(
        'HTTPS://GLOBAL.MORNINGSTAR.COM/EN-EU/INVESTMENTS/FUNDS/0P0001CLDK/QUOTE',
        '0P0001CLDK',
      ),
    ).toBe(quote);
  });

  it('should keep the Spanish cotizacion URL for ES fund pages', () => {
    expect(
      canonicalMorningstarQuoteUrl(
        'https://global.morningstar.com/es/inversiones/fondos/0P0001CLDK/cotizacion',
        '0P0001CLDK',
      ),
    ).toBe(
      'https://global.morningstar.com/es/inversiones/fondos/0P0001CLDK/cotizacion',
    );
  });

  it('should build Yahoo Finance and www.morningstar.com quote URLs', () => {
    expect(buildYahooFinanceSearchUrl('IE00BYX5NX33')).toContain(
      'q=IE00BYX5NX33',
    );
    expect(buildWwwMorningstarQuoteUrl('0P0001CLDK', MS_ASSET_TYPES.FUND)).toBe(
      'https://www.morningstar.com/funds/_/0P0001CLDK/quote',
    );
  });

  it('should prefer the www quote page when looking up share-class IDs', () => {
    expect(
      shareClassIdLookupUrls(
        '0P0001CLDK',
        'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/quote',
        MS_ASSET_TYPES.FUND,
      )[0],
    ).toBe('https://www.morningstar.com/funds/_/0P0001CLDK/quote');
  });
});
