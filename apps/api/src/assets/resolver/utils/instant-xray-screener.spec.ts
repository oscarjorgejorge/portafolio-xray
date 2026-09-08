import { MS_ASSET_TYPES } from './constants';
import {
  assetTypeFromUniverse,
  buildInstantXrayScreenerUrl,
  exchangeRank,
  morningstarIdFromScreenerRow,
  parseExchangeMic,
  parseInstantXrayScreenerResponse,
  rankInstantXrayResults,
  rowMatchesQuery,
  screenerUniversesForQuery,
} from './instant-xray-screener';

describe('instant-xray-screener', () => {
  it('builds a screener URL with the Instant X-Ray universe and ISIN', () => {
    const url = buildInstantXrayScreenerUrl('LU0328476410', 'ETALL$$ALL');

    expect(url).toContain(
      'lt.morningstar.com/api/rest.svc/klr5zyak8x/security/screener',
    );
    expect(url).toContain(encodeURIComponent('ETALL$$ALL'));
    expect(url).toContain('LU0328476410');
    expect(url).toContain('SecId');
  });

  it('uses broad universes for ISINs and exchange universes for tickers', () => {
    expect(screenerUniversesForQuery('LU0328476410')).toEqual([
      'ETALL$$ALL',
      'FOESP$$ALL',
      'E0WWE$$ALL',
    ]);
    expect(screenerUniversesForQuery('SOFI')).toContain('E0EXG$XNAS');
    expect(screenerUniversesForQuery('SOFI')).toContain('ETEXG$XLON');
  });

  it('maps universes to asset types', () => {
    expect(assetTypeFromUniverse('ETALL$$ALL')).toBe(MS_ASSET_TYPES.ETF);
    expect(assetTypeFromUniverse('E0EXG$XNAS')).toBe(MS_ASSET_TYPES.STOCK);
    expect(assetTypeFromUniverse('FOESP$$ALL')).toBe(MS_ASSET_TYPES.FUND);
  });

  it('parses exchange MICs from Instant X-Ray ExchangeId values', () => {
    expect(parseExchangeMic('EX$$$$XNAS')).toBe('XNAS');
    expect(parseExchangeMic('EXTP$$$LTS')).toBe('LTS');
    expect(exchangeRank('EX$$$$XNAS')).toBeLessThan(exchangeRank('EX$$$$XMEX'));
  });

  it('keeps only exact ISIN matches from the ETF screener payload', () => {
    const results = parseInstantXrayScreenerResponse(
      {
        total: 2,
        rows: [
          {
            SecId: '0P0000AB7T',
            Name: 'Xtrackers S&P Selec Frontier Swap ETF 1C',
            Ticker: 'XSFD',
            ISIN: 'LU0328476410',
            PerformanceId: '0P0000AB7T',
            ExchangeId: 'EX$$$$XLON',
          },
          {
            SecId: '0P00014E87',
            Name: 'iShares Edge MSCI Wld Val Fctr ETF $Acc',
            Ticker: 'IWVL',
            ISIN: 'IE00BP3QZB59',
            PerformanceId: '0P00014E87',
            ExchangeId: 'EX$$$$XLON',
          },
        ],
      },
      'LU0328476410',
      'ETALL$$ALL',
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P0000AB7T',
      isin: 'LU0328476410',
      ticker: 'XSFD',
      assetType: MS_ASSET_TYPES.ETF,
      title: 'Xtrackers S&P Selec Frontier Swap ETF 1C',
    });
    expect(results[0].url).toContain('/etfs/0P0000AB7T/quote');
  });

  it('keeps only the exact ticker and ignores Sofia name hits', () => {
    expect(
      rowMatchesQuery(
        { Name: '235 Holdings AD-Sofia Ordinary Shares', Ticker: '0A6' },
        'SOFI',
      ),
    ).toBe(false);
    expect(
      rowMatchesQuery(
        {
          Name: 'SoFi Technologies Inc Ordinary Shares',
          Ticker: 'SOFI',
          ISIN: 'US83406F1021',
        },
        'SOFI',
      ),
    ).toBe(true);

    const results = parseInstantXrayScreenerResponse(
      {
        rows: [
          {
            SecId: '0P0001E049',
            Name: '235 Holdings AD-Sofia Ordinary Shares',
            Ticker: '0A6',
            ISIN: 'BG1100017174',
            PerformanceId: '0P0001E049',
            ExchangeId: 'EX$$$$XFRA',
          },
          {
            SecId: '0P0001MMYT',
            Name: 'SoFi Technologies Inc Ordinary Shares',
            Ticker: 'SOFI',
            ISIN: 'US83406F1021',
            PerformanceId: '0P0001MMYT',
            ExchangeId: 'EX$$$$XNAS',
          },
        ],
      },
      'SOFI',
      'E0EXG$XNAS',
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P0001MMYT',
      ticker: 'SOFI',
      isin: 'US83406F1021',
      assetType: MS_ASSET_TYPES.STOCK,
    });
  });

  it('prefers the NASDAQ Amazon listing over other exchanges', () => {
    const ranked = rankInstantXrayResults(
      [
        {
          url: 'https://global.morningstar.com/en-eu/investments/stocks/0P0001TB4G/quote',
          title: 'Amazon.com Inc',
          snippet: 'Instant X-Ray | E0WWE$$ALL | XMEX',
          morningstarId: '0P0001TB4G',
          domain: 'lt.morningstar.com',
          ticker: 'AMZN',
          isin: 'US0231351067',
          assetType: MS_ASSET_TYPES.STOCK,
        },
        {
          url: 'https://global.morningstar.com/en-eu/investments/stocks/0P000000B7/quote',
          title: 'Amazon.com Inc',
          snippet: 'Instant X-Ray | E0EXG$XNAS | XNAS',
          morningstarId: '0P000000B7',
          domain: 'lt.morningstar.com',
          ticker: 'AMZN',
          isin: 'US0231351067',
          assetType: MS_ASSET_TYPES.STOCK,
        },
      ],
      'AMZN',
    );

    expect(ranked[0].morningstarId).toBe('0P000000B7');
  });

  it('extracts a performance ID from screener rows', () => {
    expect(
      morningstarIdFromScreenerRow({
        SecId: '0P00014E87',
        PerformanceId: '0P00014E87',
      }),
    ).toBe('0P00014E87');
  });

  it('uses SecId as shareClassId when Instant X-Ray omits ShareClassId', () => {
    const results = parseInstantXrayScreenerResponse(
      {
        total: 1,
        rows: [
          {
            SecId: 'F00001DES5',
            Name: 'Caixabank Destino 2035 Plus FI',
            ISIN: 'ES0114498027',
            PerformanceId: '0P0001ODL3',
          },
        ],
      },
      'ES0114498027',
      'FOESP$$ALL',
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P0001ODL3',
      shareClassId: 'F00001DES5',
      isin: 'ES0114498027',
      assetType: MS_ASSET_TYPES.FUND,
    });
  });

  it('keeps F0GBR SecId as shareClassId for French funds', () => {
    const results = parseInstantXrayScreenerResponse(
      {
        total: 1,
        rows: [
          {
            SecId: 'F0GBR04EZP',
            Name: 'AXA TrAcsor Court Terme C',
            ISIN: 'FR0000447823',
            PerformanceId: '0P00000F24',
          },
        ],
      },
      'FR0000447823',
      'FOESP$$ALL',
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P00000F24',
      shareClassId: 'F0GBR04EZP',
      isin: 'FR0000447823',
    });
  });
});
