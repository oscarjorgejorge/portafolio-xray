import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { XRayService } from './xray.service';
import { AssetsRepository } from '../assets/assets.repository';
import { ShareClassLookupService } from '../assets/share-class-lookup.service';
import { AssetType, AssetSource } from '@prisma/client';
import { MORNINGSTAR_URL } from '../common/constants';

// Mock asset for testing
const createMockAsset = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  isin: 'IE00B4L5Y983',
  morningstarId: '0P0000YXJO',
  shareClassId: null as string | null,
  shareClassVerified: false,
  ticker: 'IWDA',
  name: 'iShares Core MSCI World UCITS ETF',
  type: AssetType.ETF,
  url: 'https://www.morningstar.es/es/etf/snapshot/snapshot.aspx?id=0P0000YXJO',
  source: AssetSource.web_search,
  isinPending: false,
  isinManual: false,
  tickerManual: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('XRayService', () => {
  let service: XRayService;
  let repository: jest.Mocked<AssetsRepository>;
  let shareClassLookup: { lookupIdentityFromScreener: jest.Mock };

  const mockBaseUrl = 'https://lt.morningstar.com';

  beforeEach(async () => {
    repository = {
      findManyByMorningstarIds: jest.fn(),
      findManyByIsins: jest.fn().mockResolvedValue([]),
      update: jest
        .fn()
        .mockImplementation(async (id: string, data: object) =>
          createMockAsset({ id, ...data }),
        ),
      tryAssignShareClassId: jest
        .fn()
        .mockImplementation(
          async (
            id: string,
            shareClassId: string,
            options?: { verified?: boolean },
          ) =>
            createMockAsset({
              id,
              shareClassId,
              shareClassVerified: options?.verified ?? true,
            }),
        ),
    } as unknown as jest.Mocked<AssetsRepository>;

    shareClassLookup = {
      lookupIdentityFromScreener: jest.fn().mockResolvedValue({
        shareClassId: null,
        proxyShareClassId: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XRayService,
        { provide: AssetsRepository, useValue: repository },
        { provide: ShareClassLookupService, useValue: shareClassLookup },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockBaseUrl),
          },
        },
      ],
    }).compile();

    service = module.get<XRayService>(XRayService);
  });

  describe('generate', () => {
    describe('URL structure', () => {
      it('should generate valid Morningstar X-Ray URL', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO', type: AssetType.ETF }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain(mockBaseUrl);
        expect(result.morningstarUrl).toContain(MORNINGSTAR_URL.XRAY_PATH);
        expect(result.morningstarUrl).toContain('LanguageId=es-ES');
        expect(result.morningstarUrl).toContain('CurrencyId=EUR');
      });

      it('should use the English Morningstar report when language is en', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO', type: AssetType.ETF }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
          language: 'en',
        });

        expect(result.morningstarUrl).toContain('LanguageId=en-GB');
        expect(result.morningstarUrl).not.toContain('LanguageId=es-ES');
      });

      it('should keep English on the stock token URL', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P000003RE',
            type: AssetType.STOCK,
          }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P000003RE', weight: 100 }],
          language: 'en',
        });

        expect(result.morningstarUrl).toContain('LanguageId=en-GB');
        expect(result.morningstarUrl).toContain('SecurityTokenList=');
      });

      it('should include securityIds parameter', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO', type: AssetType.ETF }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('securityIds=');
        expect(result.morningstarUrl).toContain('0P0000YXJO');
      });

      it('should include marketValues parameter with weights in basis points', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO' }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 50 }],
        });

        // 50% weight should be 5000 basis points
        expect(result.morningstarUrl).toContain('marketValues=5000');
      });
    });

    describe('multiple assets', () => {
      it('should handle multiple assets with correct separator', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO', type: AssetType.ETF }),
          createMockAsset({
            morningstarId: 'F00000THA5',
            type: AssetType.FUND,
          }),
        ]);

        const result = await service.generate({
          assets: [
            { morningstarId: '0P0000YXJO', weight: 60 },
            { morningstarId: 'F00000THA5', weight: 40 },
          ],
        });

        expect(result.morningstarUrl).toContain('securityIds=');
        expect(result.morningstarUrl).toContain('marketValues=6000');
        expect(result.morningstarUrl).toContain('4000');
        expect(result.morningstarUrl).toContain('typeids=');
      });

      it('should batch lookup assets efficiently', async () => {
        const assets = [
          { morningstarId: '0P0000YXJO', weight: 33.33 },
          { morningstarId: 'F00000THA5', weight: 33.33 },
          { morningstarId: 'F000016RL3', weight: 33.34 },
        ];

        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO' }),
          createMockAsset({ morningstarId: 'F00000THA5' }),
          createMockAsset({ morningstarId: 'F000016RL3' }),
        ]);

        await service.generate({ assets });

        // Should make a single batch call, not 3 individual calls
        expect(repository.findManyByMorningstarIds).toHaveBeenCalledTimes(1);
        expect(repository.findManyByMorningstarIds).toHaveBeenCalledWith([
          '0P0000YXJO',
          'F00000THA5',
          'F000016RL3',
        ]);
      });
    });

    describe('asset type handling', () => {
      it('should use FO typeid for ETFs', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO', type: AssetType.ETF }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('typeids=FO');
      });

      it('should use FO typeid for FUNDs', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: 'F00000THA5',
            type: AssetType.FUND,
          }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: 'F00000THA5', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('typeids=FO');
      });

      it('should use SecurityTokenList for stocks', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P0000AAPL',
            type: AssetType.STOCK,
          }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000AAPL', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('SecurityTokenList=');
        expect(result.morningstarUrl).toContain('PortfolioType=2');
        expect(result.morningstarUrl).toContain('%5D3%5D');
        expect(result.morningstarUrl).toContain('E0WWE');
        expect(result.morningstarUrl).toContain('values=10000');
        expect(result.morningstarUrl).not.toContain('typeids=ST');
      });

      it('should tokenise funds and stocks together when any holding is a stock', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: 'F00000THA5',
            type: AssetType.FUND,
          }),
          createMockAsset({
            morningstarId: '0P000003RE',
            type: AssetType.STOCK,
          }),
        ]);

        const result = await service.generate({
          assets: [
            { morningstarId: 'F00000THA5', weight: 50 },
            { morningstarId: '0P000003RE', weight: 50 },
          ],
        });

        const tokenList = new URL(result.morningstarUrl).searchParams.get(
          'SecurityTokenList',
        );
        expect(tokenList).toContain('F00000THA5]2]0]FOESP$$ALL_1340');
        expect(tokenList).toContain('0P000003RE]3]0]E0WWE$$ALL_1340');
        expect(result.morningstarUrl).not.toContain('typeids=');
      });

      it('should default to FO typeid for assets not found in database', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([]);

        const result = await service.generate({
          assets: [{ morningstarId: 'UNKNOWN123', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('typeids=FO');
        expect(result.morningstarUrl).toContain('securityIds=UNKNOWN123');
      });
    });

    describe('security token format', () => {
      it('should remap 0P fund IDs to the verified shareClassId', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P000168OI',
            shareClassId: 'F00000VYOL',
            shareClassVerified: true,
            type: AssetType.FUND,
            url: 'https://global.morningstar.com/es/inversiones/fondos/0P000168OI/cotizacion',
          }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P000168OI', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('F00000VYOL');
        expect(result.morningstarUrl).not.toContain('0P000168OI');
        expect(result.holdingsUsingFallback).toBe(0);
        expect(
          shareClassLookup.lookupIdentityFromScreener,
        ).not.toHaveBeenCalled();
      });

      it('should not send an unverified F ID from the cached URL', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P00016YQ5',
            type: AssetType.FUND,
            name: 'Azvalor Internacional FI',
            url: 'https://global.morningstar.com/es/inversiones/fondos/F00000WI0D/cotizacion',
          }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P00016YQ5', weight: 100 }],
        });

        expect(shareClassLookup.lookupIdentityFromScreener).toHaveBeenCalled();
        expect(result.morningstarUrl).toContain('0P00016YQ5');
        expect(result.morningstarUrl).not.toContain('F00000WI0D');
      });

      it('should remap 0P fund IDs to a verified F sibling sharing the same ISIN', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P00016YQ5',
            isin: 'ES0112611001',
            type: AssetType.FUND,
            url: 'https://global.morningstar.com/es/inversiones/fondos/0P00016YQ5/cotizacion',
          }),
        ]);
        repository.findManyByIsins.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P00016YQ5',
            isin: 'ES0112611001',
            type: AssetType.FUND,
          }),
          createMockAsset({
            morningstarId: 'F00000WI0D',
            isin: 'ES0112611001',
            type: AssetType.FUND,
            shareClassId: 'F00000WI0D',
            shareClassVerified: true,
            name: 'Azvalor Internacional FI',
          }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P00016YQ5', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('F00000WI0D');
        expect(result.morningstarUrl).not.toContain('0P00016YQ5');
      });

      it('should keep 0P when the screener has no F ID', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P000168OI',
            type: AssetType.FUND,
            name: 'Renta 4 Multigestión Numantia Patrimonio Global FI',
            url: 'https://global.morningstar.com/es/inversiones/fondos/0P000168OI/cotizacion',
          }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P000168OI', weight: 100 }],
        });

        expect(shareClassLookup.lookupIdentityFromScreener).toHaveBeenCalled();
        expect(repository.tryAssignShareClassId).not.toHaveBeenCalled();
        expect(result.morningstarUrl).toContain('0P000168OI');
        expect(result.holdingsUsingFallback).toBe(1);
        expect(result.shareableUrl).toContain('0P000168OI');
      });

      it('should remap a 0P Japan fund to the Instant X-Ray F ID from the screener', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P0001CLDI',
            isin: 'IE00BYX5N771',
            type: AssetType.FUND,
            name: 'Fidelity MSCI Japan Index EUR P Acc',
          }),
        ]);
        shareClassLookup.lookupIdentityFromScreener.mockResolvedValue({
          shareClassId: 'F00001019C',
          proxyShareClassId: null,
        });

        const result = await service.generate({
          assets: [{ morningstarId: '0P0001CLDI', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('F00001019C');
        expect(result.morningstarUrl).not.toContain('0P0001CLDI');
        expect(result.holdingsUsingFallback).toBe(0);
        expect(result.holdingsUsingRelatedShareClass).toBe(0);
        expect(repository.tryAssignShareClassId).toHaveBeenCalledWith(
          expect.any(String),
          'F00001019C',
          { verified: true },
        );
      });

      it('should remap a 0P Luxembourg fund to the Instant X-Ray FOGBR ID', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P00006DAB',
            isin: 'LU0261948904',
            type: AssetType.FUND,
            name: 'Fidelity Iberia A-Acc-EUR',
          }),
        ]);
        shareClassLookup.lookupIdentityFromScreener.mockResolvedValue({
          shareClassId: 'FOGBR05KLX',
          proxyShareClassId: null,
        });

        const result = await service.generate({
          assets: [{ morningstarId: '0P00006DAB', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('FOGBR05KLX');
        expect(result.morningstarUrl).not.toContain('0P00006DAB');
        expect(result.holdingsUsingFallback).toBe(0);
        expect(repository.tryAssignShareClassId).toHaveBeenCalledWith(
          expect.any(String),
          'FOGBR05KLX',
          { verified: true },
        );
      });

      it('should replace an unverified Robeco F ID with the screener F ID for that ISIN', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P0000A9K5',
            isin: 'LU0329355670',
            shareClassId: 'F00000ZQ6Y',
            shareClassVerified: false,
            type: AssetType.FUND,
            name: 'Robeco QI Emerging Markets Active Equities D €',
            url: 'https://global.morningstar.com/es/inversiones/fondos/0P0000A9K5/cotizacion',
          }),
        ]);
        shareClassLookup.lookupIdentityFromScreener.mockResolvedValue({
          shareClassId: 'F000000RB9',
          proxyShareClassId: null,
        });

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000A9K5', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('F000000RB9');
        expect(result.morningstarUrl).not.toContain('F00000ZQ6Y');
        expect(result.shareableUrl).toContain('F000000RB9');
        expect(result.holdingsUsingFallback).toBe(0);
        expect(repository.tryAssignShareClassId).toHaveBeenCalledWith(
          expect.any(String),
          'F000000RB9',
          { verified: true },
        );
      });

      it('should use a related-class F ID in the URL without persisting it as verified', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P0001JDIC',
            isin: 'IE00BKSBDB61',
            type: AssetType.FUND,
            name: 'Polar Capital Healthcare Opps R Acc EUR',
          }),
        ]);
        shareClassLookup.lookupIdentityFromScreener.mockResolvedValue({
          shareClassId: null,
          proxyShareClassId: 'F000014W7F',
        });

        const result = await service.generate({
          assets: [{ morningstarId: '0P0001JDIC', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('F000014W7F');
        expect(result.morningstarUrl).not.toContain('0P0001JDIC');
        expect(result.holdingsUsingFallback).toBe(0);
        expect(result.holdingsUsingRelatedShareClass).toBe(1);
        expect(repository.tryAssignShareClassId).not.toHaveBeenCalled();
      });

      it('should count 0P fallbacks across a large portfolio when the screener finds nothing', async () => {
        const ids = [
          '0P0001XF3Z',
          '0P000177J8',
          '0P0001YE65',
          '0P0000A9K5',
          '0P0001CLDI',
          '0P00000F24',
          '0P0000SV4E',
          '0P0001OU74',
          '0P0001NZKP',
          '0P0001NF8R',
          '0P0001BD9S',
          '0P0001BOL6',
          '0P0001V3E7',
          '0P0001S9MR',
          'F00001019E',
          'F00000PA9N',
          'F00000YZS6',
          'F00000YU4F',
          'F00000YN5S',
          'F0GBR04NQN',
        ];
        repository.findManyByMorningstarIds.mockResolvedValue(
          ids.map((morningstarId) =>
            createMockAsset({
              morningstarId,
              type: morningstarId.startsWith('F')
                ? AssetType.FUND
                : AssetType.ETF,
              shareClassId: morningstarId.startsWith('F')
                ? morningstarId
                : null,
              url: `https://global.morningstar.com/es/inversiones/fondos/${morningstarId}/cotizacion`,
            }),
          ),
        );

        const result = await service.generate({
          assets: ids.map((morningstarId) => ({
            morningstarId,
            weight: 5,
          })),
        });

        expect(repository.tryAssignShareClassId).not.toHaveBeenCalled();
        expect(result.holdingsUsingFallback).toBe(14);
        expect(ids).toHaveLength(20);
      });

      it('should use the short Instant X-Ray URL format', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO' }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('securityIds=');
        expect(result.morningstarUrl).toContain('marketValues=');
        expect(result.morningstarUrl).toContain('typeids=');
        expect(result.morningstarUrl).not.toContain('SecurityTokenList=');
        expect(result.morningstarUrl).not.toContain('$$ALL_1340');
      });
    });

    describe('weight conversion', () => {
      it('should convert percentage to basis points correctly', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO' }),
          createMockAsset({ morningstarId: 'F00000THA5' }),
        ]);

        const result = await service.generate({
          assets: [
            { morningstarId: '0P0000YXJO', weight: 25.5 },
            { morningstarId: 'F00000THA5', weight: 74.5 },
          ],
        });

        // 25.5% = 2550 basis points, 74.5% = 7450 basis points
        expect(result.morningstarUrl).toContain('2550');
        expect(result.morningstarUrl).toContain('7450');
      });

      it('should round decimal weights to whole basis points', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO' }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 33.333 }],
        });

        // 33.333% * 100 = 3333.3, rounded to 3333
        expect(result.morningstarUrl).toContain('3333');
      });
    });

    describe('shareable URL', () => {
      it('should generate shareable URL with assets encoded', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([]);

        const result = await service.generate({
          assets: [
            { morningstarId: '0P0000YXJO', weight: 60 },
            { morningstarId: 'F00000THA5', weight: 40 },
          ],
        });

        expect(result.shareableUrl).toContain('/xray?assets=');
        expect(result.shareableUrl).toContain('0P0000YXJO');
        expect(result.shareableUrl).toContain('F00000THA5');
        expect(result.shareableUrl).toContain('60');
        expect(result.shareableUrl).toContain('40');
      });

      it('should URL encode special characters in shareable URL', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
        });

        // The : character should be URL encoded
        expect(result.shareableUrl).toContain(encodeURIComponent(':'));
      });
    });
  });
});
