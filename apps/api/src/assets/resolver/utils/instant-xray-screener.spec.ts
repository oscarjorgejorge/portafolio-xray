import { MS_ASSET_TYPES } from './constants';
import {
  assetTypeFromUniverse,
  buildInstantXrayScreenerUrl,
  exchangeRank,
  joinScreenerUniverseIds,
  morningstarIdFromScreenerRow,
  parseExchangeMic,
  parseInstantXrayScreenerResponse,
  rankInstantXrayResults,
  rowMatchesQuery,
  screenerUniversesForQuery,
  pickShareClassIdFromScreenerResults,
  pickIdentityFromScreenerResults,
  pickVerifiedIdentityFromScreenerResults,
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
    expect(url).toContain('Universe');
  });

  it('joins ISIN universes for a single Instant X-Ray request', () => {
    expect(
      joinScreenerUniverseIds(screenerUniversesForQuery('LU0666200265')),
    ).toBe('FOESP$$ALL|FOEUR$$ALL|FOGBR$$ALL|ETALL$$ALL|E0WWE$$ALL');
  });

  it('uses broad universes for ISINs, Morningstar IDs and exchange universes for tickers', () => {
    expect(screenerUniversesForQuery('LU0328476410')).toEqual([
      'FOESP$$ALL',
      'FOEUR$$ALL',
      'FOGBR$$ALL',
      'ETALL$$ALL',
      'E0WWE$$ALL',
    ]);
    expect(screenerUniversesForQuery('0P0001CLDI')).toEqual([
      'FOESP$$ALL',
      'FOEUR$$ALL',
      'FOGBR$$ALL',
      'ETALL$$ALL',
      'E0WWE$$ALL',
    ]);
    expect(screenerUniversesForQuery('SOFI')).toContain('E0EXG$XNAS');
    expect(screenerUniversesForQuery('SOFI')).toContain('ETEXG$XLON');
  });

  it('maps universes to asset types', () => {
    expect(assetTypeFromUniverse('ETALL$$ALL')).toBe(MS_ASSET_TYPES.ETF);
    expect(assetTypeFromUniverse('E0EXG$XNAS')).toBe(MS_ASSET_TYPES.STOCK);
    expect(assetTypeFromUniverse('FOESP$$ALL')).toBe(MS_ASSET_TYPES.FUND);
    expect(assetTypeFromUniverse('FOEUR$$ALL')).toBe(MS_ASSET_TYPES.FUND);
    expect(assetTypeFromUniverse('FOGBR$$ALL')).toBe(MS_ASSET_TYPES.FUND);
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

  it('keeps FOGBR SecId as shareClassId for Luxembourg funds', () => {
    const results = parseInstantXrayScreenerResponse(
      {
        total: 1,
        rows: [
          {
            SecId: 'FOGBR05KLX',
            Name: 'Fidelity Iberia A-Acc-EUR',
            ISIN: 'LU0261948904',
            PerformanceId: '0P00006DAB',
            FundShareClassId: 'FOGBR05KLX',
          },
        ],
      },
      'LU0261948904',
      'FOESP$$ALL',
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P00006DAB',
      shareClassId: 'FOGBR05KLX',
      isin: 'LU0261948904',
    });
    expect(
      pickVerifiedIdentityFromScreenerResults(results, {
        isin: 'LU0261948904',
        performanceId: '0P00006DAB',
        name: 'Fidelity Iberia A-Acc-EUR',
      }),
    ).toEqual({
      shareClassId: 'FOGBR05KLX',
      isin: 'LU0261948904',
    });
  });

  it('reads European FOEUR hits and types them from the row Universe', () => {
    const joined = joinScreenerUniverseIds(
      screenerUniversesForQuery('LU0666200265'),
    );
    const results = parseInstantXrayScreenerResponse(
      {
        total: 1,
        rows: [
          {
            SecId: 'F00000NG7B',
            Name: 'HSBC GIF Frontier Markets AD',
            ISIN: 'LU0666200265',
            PerformanceId: '0P0000UU8G',
            FundShareClassId: 'F00000NG7B',
            Universe: 'FOEUR$$ALL',
          },
        ],
      },
      'LU0666200265',
      joined,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P0000UU8G',
      shareClassId: 'F00000NG7B',
      isin: 'LU0666200265',
      assetType: MS_ASSET_TYPES.FUND,
    });
    expect(results[0].snippet).toContain('FOEUR$$ALL');
    expect(
      pickVerifiedIdentityFromScreenerResults(results, {
        isin: 'LU0666200265',
        performanceId: '0P0000UU8G',
        name: 'HSBC GIF Frontier Markets AD',
      }),
    ).toEqual({
      shareClassId: 'F00000NG7B',
      isin: 'LU0666200265',
    });
  });

  it('prefers a FOESP share-class hit over a FOEUR duplicate of the same 0P ID', () => {
    const ranked = rankInstantXrayResults(
      [
        {
          url: 'https://global.morningstar.com/en-eu/investments/funds/0P00006DAB/quote',
          title: 'Fidelity Iberia A-Acc-EUR',
          snippet: 'Instant X-Ray | FOEUR$$ALL |',
          morningstarId: '0P00006DAB',
          domain: 'lt.morningstar.com',
          shareClassId: 'F00000AAAA',
          isin: 'LU0261948904',
          assetType: MS_ASSET_TYPES.FUND,
        },
        {
          url: 'https://global.morningstar.com/en-eu/investments/funds/0P00006DAB/quote',
          title: 'Fidelity Iberia A-Acc-EUR',
          snippet: 'Instant X-Ray | FOESP$$ALL |',
          morningstarId: '0P00006DAB',
          domain: 'lt.morningstar.com',
          shareClassId: 'FOGBR05KLX',
          isin: 'LU0261948904',
          assetType: MS_ASSET_TYPES.FUND,
        },
      ],
      'LU0261948904',
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].shareClassId).toBe('FOGBR05KLX');
    expect(ranked[0].snippet).toContain('FOESP$$ALL');
  });

  it('reads FOEUR hits for Luxembourg funds missing from FOESP', () => {
    const joinedUniverses = joinScreenerUniverseIds(
      screenerUniversesForQuery('LU0666200265'),
    );
    const results = parseInstantXrayScreenerResponse(
      {
        total: 1,
        rows: [
          {
            SecId: 'F00000NG7B',
            Name: 'HSBC GIF Frontier Markets AD',
            ISIN: 'LU0666200265',
            PerformanceId: '0P0000UU8G',
            FundShareClassId: 'F00000NG7B',
            Universe: 'FOEUR$$ALL',
          },
        ],
      },
      'LU0666200265',
      joinedUniverses,
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P0000UU8G',
      shareClassId: 'F00000NG7B',
      isin: 'LU0666200265',
      assetType: MS_ASSET_TYPES.FUND,
      snippet: 'Instant X-Ray | FOEUR$$ALL | ',
    });
    expect(
      pickVerifiedIdentityFromScreenerResults(results, {
        isin: 'LU0666200265',
        performanceId: '0P0000UU8G',
        name: 'HSBC GIF Frontier Markets AD',
      }),
    ).toEqual({
      shareClassId: 'F00000NG7B',
      isin: 'LU0666200265',
    });
  });

  it('prefers a FOESP share-class hit over the same 0P ID from FOEUR', () => {
    const ranked = rankInstantXrayResults(
      [
        {
          url: 'https://global.morningstar.com/en-eu/investments/funds/0P00006DAB/quote',
          title: 'Fidelity Iberia A-Acc-EUR',
          snippet: 'Instant X-Ray | FOEUR$$ALL | ',
          morningstarId: '0P00006DAB',
          domain: 'lt.morningstar.com',
          shareClassId: 'F00000AAAA',
          isin: 'LU0261948904',
          assetType: MS_ASSET_TYPES.FUND,
        },
        {
          url: 'https://global.morningstar.com/en-eu/investments/funds/0P00006DAB/quote',
          title: 'Fidelity Iberia A-Acc-EUR',
          snippet: 'Instant X-Ray | FOESP$$ALL | ',
          morningstarId: '0P00006DAB',
          domain: 'lt.morningstar.com',
          shareClassId: 'FOGBR05KLX',
          isin: 'LU0261948904',
          assetType: MS_ASSET_TYPES.FUND,
        },
      ],
      'LU0261948904',
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].shareClassId).toBe('FOGBR05KLX');
    expect(ranked[0].snippet).toContain('FOESP$$ALL');
  });

  it('matches a 0P performance ID and exposes the F SecId as shareClassId', () => {
    const results = parseInstantXrayScreenerResponse(
      {
        total: 1,
        rows: [
          {
            SecId: 'F00001019C',
            Name: 'Fidelity MSCI Japan Index EUR P Acc',
            ISIN: 'IE00BYX5N771',
            PerformanceId: '0P0001CLDI',
          },
        ],
      },
      '0P0001CLDI',
      'FOESP$$ALL',
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P0001CLDI',
      shareClassId: 'F00001019C',
      isin: 'IE00BYX5N771',
    });
    expect(pickShareClassIdFromScreenerResults(results)).toBe('F00001019C');
  });

  it('picks shareClassId and ISIN together from screener results', () => {
    expect(
      pickIdentityFromScreenerResults([
        {
          morningstarId: '0P0001CLDI',
          shareClassId: 'F00001019C',
          isin: 'IE00BYX5N771',
          title: 'Fidelity MSCI Japan Index EUR P Acc',
          snippet: '',
          url: 'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDI/quote',
          domain: 'lt.morningstar.com',
          assetType: MS_ASSET_TYPES.FUND,
        },
      ]),
    ).toEqual({
      shareClassId: 'F00001019C',
      isin: 'IE00BYX5N771',
    });
  });

  it('rejects an F ID whose ISIN does not match the user ISIN', () => {
    expect(
      pickVerifiedIdentityFromScreenerResults(
        [
          {
            morningstarId: '0P0001AAAA',
            shareClassId: 'F00000ZQ6Y',
            isin: 'LU1675172180',
            title: 'Robeco QI Chinese A-share Active Equities Z €',
            snippet: '',
            url: 'https://global.morningstar.com/en-eu/investments/funds/0P0001AAAA/quote',
            domain: 'lt.morningstar.com',
            assetType: MS_ASSET_TYPES.FUND,
          },
        ],
        {
          isin: 'LU0329355670',
          performanceId: '0P0000A9K5',
          name: 'Robeco QI Emerging Markets Active Equities D €',
        },
      ),
    ).toEqual({
      shareClassId: null,
      isin: 'LU0329355670',
    });
  });

  it('picks the F ID whose ISIN matches the Emerging Markets fund', () => {
    expect(
      pickVerifiedIdentityFromScreenerResults(
        [
          {
            morningstarId: '0P0000A9K5',
            shareClassId: 'F000000RB9',
            isin: 'LU0329355670',
            title: 'Robeco QI EM Active Equities D €',
            snippet: '',
            url: 'https://global.morningstar.com/en-eu/investments/funds/0P0000A9K5/quote',
            domain: 'lt.morningstar.com',
            assetType: MS_ASSET_TYPES.FUND,
          },
        ],
        {
          isin: 'LU0329355670',
          performanceId: '0P0000A9K5',
          name: 'Robeco QI Emerging Markets Active Equities D €',
        },
      ),
    ).toEqual({
      shareClassId: 'F000000RB9',
      isin: 'LU0329355670',
    });
  });
});
