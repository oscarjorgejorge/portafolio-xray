import { Test, TestingModule } from '@nestjs/testing';
import { InstantXrayScreenerStrategy } from './instant-xray-screener.strategy';
import { HttpClientService } from '../../../common/http';
import { MS_ASSET_TYPES } from '../utils/constants';

describe('InstantXrayScreenerStrategy', () => {
  let strategy: InstantXrayScreenerStrategy;
  let httpClient: { get: jest.Mock };

  beforeEach(async () => {
    httpClient = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstantXrayScreenerStrategy,
        { provide: HttpClientService, useValue: httpClient },
      ],
    }).compile();

    strategy = module.get(InstantXrayScreenerStrategy);
  });

  it('queries universes in parallel batches of two and stops after the first hit', async () => {
    httpClient.get
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { total: 0, rows: [] },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          total: 1,
          rows: [
            {
              SecId: 'F0GBR04DVY',
              Name: 'Schroder ISF EURO Corp Bd C Acc EUR',
              ISIN: 'LU0113258742',
              PerformanceId: '0P00000DZ1',
              FundShareClassId: 'F0GBR04DVY',
              Universe: 'FOEUR$$ALL',
            },
          ],
        },
      });

    const results = await strategy.search('LU0113258742');

    expect(httpClient.get).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P00000DZ1',
      shareClassId: 'F0GBR04DVY',
      isin: 'LU0113258742',
      assetType: MS_ASSET_TYPES.FUND,
    });

    const urls = httpClient.get.mock.calls.map((call) => call[0] as string);
    expect(urls[0]).toContain(encodeURIComponent('FOESP$$ALL'));
    expect(urls[1]).toContain(encodeURIComponent('FOEUR$$ALL'));
    for (const url of urls) {
      const universeIds = new URL(url).searchParams.get('universeIds');
      expect(universeIds).toBeTruthy();
      expect(universeIds).not.toContain('|');
    }
  });

  it('continues to the next batch when the first two universes miss', async () => {
    httpClient.get
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { total: 0, rows: [] },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { total: 0, rows: [] },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: {
          total: 1,
          rows: [
            {
              SecId: 'F00000AAAA',
              Name: 'Example Fund',
              ISIN: 'LU0113258742',
              PerformanceId: '0P00000AAA',
              Universe: 'FOGBR$$ALL',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { total: 0, rows: [] },
      });

    const results = await strategy.search('LU0113258742');

    expect(httpClient.get).toHaveBeenCalledTimes(4);
    expect(results).toHaveLength(1);
    expect(results[0].shareClassId).toBe('F00000AAAA');
  });

  it('resolves a ticker with Ticker:EQ on the equity and ETF universes', async () => {
    httpClient.get.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        total: 1,
        rows: [
          {
            SecId: '0P0000A5RZ',
            Name: 'Banco Bilbao Vizcaya Argentaria SA',
            Ticker: 'BBVA',
            ISIN: 'ES0113211835',
            PerformanceId: '0P0000A5RZ',
            ExchangeId: 'EX$$$$XMAD',
            Universe: 'E0WWE$$ALL',
          },
        ],
      },
    });

    const results = await strategy.search('BBVA');

    expect(httpClient.get).toHaveBeenCalledTimes(2);
    const urls = httpClient.get.mock.calls.map((call) => call[0] as string);
    expect(urls[0]).toContain(encodeURIComponent('E0WWE$$ALL'));
    expect(urls[1]).toContain(encodeURIComponent('ETALL$$ALL'));
    for (const url of urls) {
      const params = new URL(url).searchParams;
      expect(params.get('filters')).toBe('Ticker:EQ:BBVA');
      expect(params.get('term')).toBeNull();
    }
    expect(results[0]).toMatchObject({
      morningstarId: '0P0000A5RZ',
      ticker: 'BBVA',
      isin: 'ES0113211835',
      assetType: MS_ASSET_TYPES.STOCK,
    });
  });

  it('keeps only the venue named by an exchange suffix', async () => {
    httpClient.get.mockImplementation(async (url: string) => {
      if (url.includes(encodeURIComponent('ETALL$$ALL'))) {
        return { ok: true, status: 200, data: { total: 0, rows: [] } };
      }
      return {
        ok: true,
        status: 200,
        data: {
          total: 2,
          rows: [
            {
              SecId: '0P0000A5RZ',
              Name: 'Banco Bilbao Vizcaya Argentaria SA',
              Ticker: 'BBVA',
              ISIN: 'ES0113211835',
              PerformanceId: '0P0000A5RZ',
              ExchangeId: 'EX$$$$XMAD',
              Universe: 'E0WWE$$ALL',
            },
            {
              SecId: '0P000000OX',
              Name: 'Banco Bilbao Vizcaya Argentaria SA ADR',
              Ticker: 'BBVA',
              ISIN: 'US05946K1016',
              PerformanceId: '0P000000OX',
              ExchangeId: 'EX$$$$XNYS',
              Universe: 'E0WWE$$ALL',
            },
          ],
        },
      };
    });

    const results = await strategy.search('BBVA.MC');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      morningstarId: '0P0000A5RZ',
      isin: 'ES0113211835',
    });
    const filters = httpClient.get.mock.calls.map((call) =>
      new URL(call[0] as string).searchParams.get('filters'),
    );
    expect(filters).toContain('Ticker:EQ:BBVA');
  });

  it('asks for both lines when the ticker is shared by different ISINs', async () => {
    httpClient.get.mockImplementation(async (url: string) => {
      if (url.includes(encodeURIComponent('ETALL$$ALL'))) {
        return { ok: true, status: 200, data: { total: 0, rows: [] } };
      }
      return {
        ok: true,
        status: 200,
        data: {
          total: 2,
          rows: [
            {
              SecId: '0P0000A5RZ',
              Name: 'Banco Bilbao Vizcaya Argentaria SA',
              Ticker: 'BBVA',
              ISIN: 'ES0113211835',
              PerformanceId: '0P0000A5RZ',
              ExchangeId: 'EX$$$$XMAD',
            },
            {
              SecId: '0P000000OX',
              Name: 'Banco Bilbao Vizcaya Argentaria SA ADR',
              Ticker: 'BBVA',
              ISIN: 'US05946K1016',
              PerformanceId: '0P000000OX',
              ExchangeId: 'EX$$$$XNYS',
            },
          ],
        },
      };
    });

    const results = await strategy.search('BBVA');

    expect(results.map((result) => result.isin)).toEqual([
      'ES0113211835',
      'US05946K1016',
    ]);
  });

  it('reads the next screener page when the ticker has more listings', async () => {
    httpClient.get.mockImplementation(async (url: string) => {
      const params = new URL(url).searchParams;
      if (params.get('universeIds') === 'ETALL$$ALL') {
        return { ok: true, status: 200, data: { total: 0, rows: [] } };
      }
      if (params.get('page') === '2') {
        return {
          ok: true,
          status: 200,
          data: {
            total: 26,
            rows: [
              {
                SecId: '0P000000OX',
                Name: 'Banco Bilbao Vizcaya Argentaria SA ADR',
                Ticker: 'BBVA',
                ISIN: 'US05946K1016',
                PerformanceId: '0P000000OX',
                ExchangeId: 'EX$$$$XNYS',
              },
            ],
          },
        };
      }
      return {
        ok: true,
        status: 200,
        data: {
          total: 26,
          rows: Array.from({ length: 25 }, (_, index) => ({
            SecId: `0P0000A5R${index}`,
            Name: 'Banco Bilbao Vizcaya Argentaria SA',
            Ticker: 'BBVA',
            ISIN: 'ES0113211835',
            PerformanceId: `0P0000A5R${index}`,
            ExchangeId: 'EX$$$$XMAD',
          })),
        },
      };
    });

    const results = await strategy.search('BBVA');

    expect(results.map((result) => result.isin)).toEqual([
      'ES0113211835',
      'US05946K1016',
    ]);
    const pages = httpClient.get.mock.calls
      .map((call) => new URL(call[0] as string).searchParams.get('page'))
      .filter((page) => page === '2');
    expect(pages.length).toBeGreaterThan(0);
  });

  it('uses a 10s timeout per universe request', async () => {
    httpClient.get.mockResolvedValue({
      ok: true,
      status: 200,
      data: { total: 0, rows: [] },
    });

    await strategy.search('LU0113258742');

    expect(httpClient.get.mock.calls[0][1]).toMatchObject({
      timeout: 10_000,
      responseType: 'json',
    });
  });
});
