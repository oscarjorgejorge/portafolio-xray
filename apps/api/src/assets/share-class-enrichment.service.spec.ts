import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { AssetType, AssetSource } from '@prisma/client';
import { ShareClassEnrichmentService } from './share-class-enrichment.service';
import { ShareClassLookupService } from './share-class-lookup.service';
import { AssetsRepository } from './assets.repository';

const createMockAsset = (overrides = {}) => ({
  id: 'asset-1',
  isin: 'ES0173311103',
  morningstarId: '0P000168OI',
  shareClassId: null as string | null,
  ticker: null,
  name: 'Test Fund',
  type: AssetType.FUND,
  url: 'https://global.morningstar.com/es/inversiones/fondos/0P000168OI/cotizacion',
  source: AssetSource.web_search,
  isinPending: false,
  isinManual: false,
  tickerManual: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ShareClassEnrichmentService', () => {
  let service: ShareClassEnrichmentService;
  let repository: jest.Mocked<AssetsRepository>;
  let lookup: jest.Mocked<ShareClassLookupService>;
  let cacheManager: jest.Mocked<Cache>;

  beforeEach(async () => {
    repository = {
      findById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<AssetsRepository>;

    lookup = {
      lookupForAsset: jest.fn(),
    } as unknown as jest.Mocked<ShareClassLookupService>;

    cacheManager = {
      del: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Cache>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareClassEnrichmentService,
        { provide: AssetsRepository, useValue: repository },
        { provide: ShareClassLookupService, useValue: lookup },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              shareClassEnrichmentConcurrency: 2,
              shareClassEnrichmentTimeoutMs: 15000,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ShareClassEnrichmentService);
  });

  it('should persist shareClassId and invalidate cache', async () => {
    const asset = createMockAsset();
    repository.findById.mockResolvedValue(asset);
    lookup.lookupForAsset.mockResolvedValue('F00000VYOL');
    repository.update.mockResolvedValue({
      ...asset,
      shareClassId: 'F00000VYOL',
    });

    service.enrichShareClassInBackground(asset.id);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(lookup.lookupForAsset).toHaveBeenCalledWith(asset);
    expect(repository.update).toHaveBeenCalledWith(asset.id, {
      shareClassId: 'F00000VYOL',
    });
    expect(cacheManager.del).toHaveBeenCalled();
  });

  it('should skip lookup when the asset already has an F ID', async () => {
    const asset = createMockAsset({
      morningstarId: 'F00000VYOL',
      shareClassId: 'F00000VYOL',
    });
    repository.findById.mockResolvedValue(asset);

    service.enrichShareClassInBackground(asset.id);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(lookup.lookupForAsset).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('should ignore duplicate enqueue for the same asset', () => {
    repository.findById.mockReturnValue(new Promise(() => undefined));

    service.enrichShareClassInBackground('asset-1');
    service.enrichShareClassInBackground('asset-1');

    expect(service.isEnrichmentInProgress('asset-1')).toBe(true);
    expect(service.getActiveEnrichmentCount()).toBe(1);
  });
});
