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
