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
  let shareClassLookup: { lookupShareClassIdFromScreener: jest.Mock };

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
        .mockImplementation(async (id: string, shareClassId: string) =>
          createMockAsset({ id, shareClassId }),
        ),
    } as unknown as jest.Mocked<AssetsRepository>;

    shareClassLookup = {
      lookupShareClassIdFromScreener: jest.fn().mockResolvedValue(null),
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
        expect(result.morningstarUrl).toContain('PortfolioType=2');
      });

      it('should include SecurityTokenList parameter', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO', type: AssetType.ETF }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('SecurityTokenList=');
        expect(result.morningstarUrl).toContain('0P0000YXJO');
      });

      it('should include values parameter with weights in basis points', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO' }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 50 }],
        });

        // 50% weight should be 5000 basis points
        expect(result.morningstarUrl).toContain('values=5000');
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

        // URL-encoded | separator
        expect(result.morningstarUrl).toContain('SecurityTokenList=');
        // Values should be separated by |
        expect(result.morningstarUrl).toContain('values=6000');
        expect(result.morningstarUrl).toContain('4000');
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
      it('should use FUND type code (2) for ETFs', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO', type: AssetType.ETF }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
        });

        // Type code 2 in security token
        expect(result.morningstarUrl).toContain('%5D2%5D'); // ]2]
      });

      it('should use FUND type code (2) for FUNDs', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: 'F00000THA5',
            type: AssetType.FUND,
          }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: 'F00000THA5', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('%5D2%5D'); // ]2]
      });

      it('should use STOCK type code (3) for stocks', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P0000AAPL',
            type: AssetType.STOCK,
          }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000AAPL', weight: 100 }],
        });

        // Type code 3 in security token
        expect(result.morningstarUrl).toContain('%5D3%5D'); // ]3]
      });

      it('should use FUND exchange code (FOESP) for funds/ETFs', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO', type: AssetType.ETF }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('FOESP');
      });

      it('should use STOCK exchange code (E0WWE) for stocks', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P0000AAPL',
            type: AssetType.STOCK,
          }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000AAPL', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('E0WWE');
      });

      it('should use default codes for assets not found in database', async () => {
        // Asset not in database
        repository.findManyByMorningstarIds.mockResolvedValue([]);

        const result = await service.generate({
          assets: [{ morningstarId: 'UNKNOWN123', weight: 100 }],
        });

        // Should default to FUND type code (2) and FOESP exchange
        expect(result.morningstarUrl).toContain('%5D2%5D'); // ]2]
        expect(result.morningstarUrl).toContain('FOESP');
      });
    });

    describe('security token format', () => {
      it('should remap 0P fund IDs to the persisted shareClassId', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({
            morningstarId: '0P000168OI',
            shareClassId: 'F00000VYOL',
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
      });

      it('should remap 0P fund IDs to F IDs found in the cached URL', async () => {
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

        expect(result.morningstarUrl).toContain('F00000WI0D');
        expect(result.morningstarUrl).not.toContain('0P00016YQ5');
      });

      it('should remap 0P fund IDs to an F sibling sharing the same ISIN', async () => {
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

        expect(
          shareClassLookup.lookupShareClassIdFromScreener,
        ).toHaveBeenCalled();
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
        shareClassLookup.lookupShareClassIdFromScreener.mockResolvedValue(
          'F00001019C',
        );

        const result = await service.generate({
          assets: [{ morningstarId: '0P0001CLDI', weight: 100 }],
        });

        expect(result.morningstarUrl).toContain('F00001019C');
        expect(result.morningstarUrl).not.toContain('0P0001CLDI');
        expect(result.holdingsUsingFallback).toBe(0);
        expect(repository.tryAssignShareClassId).toHaveBeenCalledWith(
          expect.any(String),
          'F00001019C',
        );
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

      it('should include security token suffix', async () => {
        repository.findManyByMorningstarIds.mockResolvedValue([
          createMockAsset({ morningstarId: '0P0000YXJO' }),
        ]);

        const result = await service.generate({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
        });

        // Should include $$ALL_1340 suffix (URL encoded)
        expect(result.morningstarUrl).toContain(
          encodeURIComponent('$$ALL_1340'),
        );
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
