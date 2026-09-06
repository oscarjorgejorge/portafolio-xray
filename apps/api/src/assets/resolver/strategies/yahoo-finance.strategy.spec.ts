import {
  orderYahooQuotesForWwwLookup,
  parseYahooFinanceSearch,
} from './yahoo-finance.strategy';
import { MS_ASSET_TYPES } from '../utils/constants';

describe('parseYahooFinanceSearch', () => {
  it('extracts the 0P performance ID from Yahoo fund symbols', () => {
    const results = parseYahooFinanceSearch(
      JSON.stringify({
        quotes: [
          {
            symbol: 'IE00BYX5NX33.SG',
            shortname: 'Fidelity MSCI World Index Fund ',
            quoteType: 'MUTUALFUND',
          },
          {
            symbol: '0P0001CLDK.F',
            shortname: '0P0001CLDK.F',
            longname: 'Fidelity MSCI World Index EUR P Acc',
            quoteType: 'MUTUALFUND',
          },
        ],
      }),
      'IE00BYX5NX33',
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P0001CLDK',
      isin: 'IE00BYX5NX33',
      assetType: MS_ASSET_TYPES.FUND,
      title: 'Fidelity MSCI World Index EUR P Acc',
    });
    expect(results[0].url).toContain(
      '/en-eu/investments/funds/0P0001CLDK/quote',
    );
  });

  it('returns nothing when Yahoo has no Morningstar ID', () => {
    expect(
      parseYahooFinanceSearch(
        JSON.stringify({
          quotes: [{ symbol: 'VWCE.DE', quoteType: 'ETF' }],
        }),
        'IE00BK5BQT80',
      ),
    ).toEqual([]);
  });
});

describe('orderYahooQuotesForWwwLookup', () => {
  it('puts the exact ticker ahead of secondary listings', () => {
    const ordered = orderYahooQuotesForWwwLookup(
      [
        { symbol: '8FS.F', exchange: 'FRA', quoteType: 'EQUITY' },
        { symbol: 'SOFI', exchange: 'NMS', quoteType: 'EQUITY' },
      ],
      'SOFI',
    );

    expect(ordered.map((quote) => quote.symbol)).toEqual(['SOFI', '8FS.F']);
  });
});
