import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { XRayService } from './xray.service';
import { AssetsRepository } from '../assets/assets.repository';
import { AssetType, AssetSource } from '@prisma/client';
import { MORNINGSTAR_URL } from '../common/constants';

// Mock asset for testing
const createMockAsset = (overrides = {}) => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  isin: 'IE00B4L5Y983',
  morningstarId: '0P0000YXJO',
  ticker: 'IWDA',
  name: 'iShares Core MSCI World UCITS ETF',
  type: AssetType.ETF,
  url: 'https://www.morningstar.es/es/etf/snapshot/snapshot.aspx?id=0P0000YXJO',
  source: AssetSource.web_search,
  isinPending: false,
  isinManual: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('XRayService', () => {
  let service: XRayService;
  let repository: jest.Mocked<AssetsRepository>;

  const mockBaseUrl = 'https://lt.morningstar.com';

  beforeEach(async () => {
    repository = {
      findManyByMorningstarIds: jest.fn(),
    } as unknown as jest.Mocked<AssetsRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XRayService,
        { provide: AssetsRepository, useValue: repository },
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
