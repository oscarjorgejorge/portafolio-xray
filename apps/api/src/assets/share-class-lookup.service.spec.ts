import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AssetType } from '@prisma/client';
import { ShareClassLookupService } from './share-class-lookup.service';
import { InstantXrayScreenerStrategy } from './resolver/strategies/instant-xray-screener.strategy';
import { HttpClientService } from '../common/http';
import { MS_ASSET_TYPES } from './resolver/utils/constants';

describe('ShareClassLookupService', () => {
  let service: ShareClassLookupService;
  let screener: { search: jest.Mock };
  let httpClient: { get: jest.Mock };

  beforeEach(async () => {
    screener = { search: jest.fn() };
    httpClient = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareClassLookupService,
        { provide: InstantXrayScreenerStrategy, useValue: screener },
        { provide: HttpClientService, useValue: httpClient },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              shareClassEnrichmentTimeoutMs: 15000,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ShareClassLookupService);
  });

  it('should take the F ID from the Instant X-Ray screener by ISIN', async () => {
    screener.search.mockResolvedValue([
      {
        morningstarId: '0P0001CLDI',
        shareClassId: 'F00001019C',
        isin: 'IE00BYX5N771',
        title: 'Fidelity MSCI Japan Index EUR P Acc',
        url: 'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDI/quote',
        domain: 'lt.morningstar.com',
        assetType: MS_ASSET_TYPES.FUND,
      },
    ]);

    const shareClassId = await service.lookupForAsset({
      morningstarId: '0P0001CLDI',
      isin: 'IE00BYX5N771',
      type: AssetType.FUND,
      url: 'https://global.morningstar.com/es/inversiones/fondos/0P0001CLDI/cotizacion',
    });

    expect(shareClassId).toBe('F00001019C');
    expect(screener.search).toHaveBeenCalledWith('IE00BYX5N771');
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it('should return F ID and ISIN from the screener without scraping quote pages', async () => {
    screener.search.mockResolvedValue([
      {
        morningstarId: '0P00000F24',
        shareClassId: 'F0GBR04EZP',
        isin: 'FR0000447823',
        title: 'AXA Tresor',
        url: 'https://global.morningstar.com/en-eu/investments/funds/0P00000F24/quote',
        domain: 'lt.morningstar.com',
        assetType: MS_ASSET_TYPES.FUND,
      },
    ]);

    const identity = await service.lookupIdentityFromScreener({
      morningstarId: '0P00000F24',
    });

    expect(identity).toEqual({
      shareClassId: 'F0GBR04EZP',
      isin: 'FR0000447823',
    });
    expect(screener.search).toHaveBeenCalledWith('0P00000F24');
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it('should fall back to quote pages when the screener has no F ID', async () => {
    screener.search.mockResolvedValue([]);
    httpClient.get.mockResolvedValue({
      ok: true,
      status: 200,
      data: '<div security-id="F00000VYOL"></div>',
    });

    const shareClassId = await service.lookupForAsset({
      morningstarId: '0P000168OI',
      type: AssetType.FUND,
      url: 'https://global.morningstar.com/es/inversiones/fondos/0P000168OI/cotizacion',
    });

    expect(shareClassId).toBe('F00000VYOL');
    expect(httpClient.get).toHaveBeenCalled();
  });
});
