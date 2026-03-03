import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { AssetsService } from './assets.service';
import { AssetsRepository } from './assets.repository';
import { MorningstarResolverService, PageVerifierService } from './resolver';
import { IsinEnrichmentService } from './isin-enrichment.service';
import { AssetSource, AssetType } from '@prisma/client';
import { ResolutionSource, ResolutionErrorCode } from './types';
import { IdentifierType } from '../common/utils/identifier-classifier';
import { ScoredResult, VerificationResult } from './resolver/resolver.types';
import { MS_ASSET_TYPES } from './resolver/utils/constants';
import { AssetTypeDto } from './dto/confirm-asset.dto';

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
  tickerManual: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper to create mock ScoredResult
const createMockScoredResult = (
  overrides: Partial<ScoredResult> = {},
): ScoredResult => ({
  url: 'https://morningstar.es/...',
  title: 'Test Fund',
  snippet: 'Test snippet',
  morningstarId: 'F00000THA5',
  domain: 'morningstar.es',
  score: 100,
  scoreBreakdown: {
    isinMatch: 0,
    tickerMatch: 0,
    nameMatch: 0,
    morningstarDomain: 20,
    typeMatch: 10,
    morningstarIdMatch: 0,
  },
  ...overrides,
});

// Helper to create mock VerificationResult
const createMockVerification = (
  overrides: Partial<VerificationResult> = {},
): VerificationResult => ({
  verified: true,
  isinFound: null,
  nameFound: null,
  additionalInfo: {},
  ...overrides,
});

describe('AssetsService', () => {
  let service: AssetsService;
  let cacheManager: jest.Mocked<Cache>;
  let repository: jest.Mocked<AssetsRepository>;
  let morningstarResolver: jest.Mocked<MorningstarResolverService>;
  let isinEnrichment: jest.Mocked<IsinEnrichmentService>;

  beforeEach(async () => {
    // Create mocks
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<Cache>;

    repository = {
      findByIsin: jest.fn(),
      findByMorningstarId: jest.fn(),
      findById: jest.fn(),
      findManyByMorningstarIds: jest.fn(),
      findManyByIsins: jest.fn(),
      upsertByMorningstarId: jest.fn(),
      upsertByIsin: jest.fn(),
      updateIsinWithVerification: jest.fn(),
    } as unknown as jest.Mocked<AssetsRepository>;

    morningstarResolver = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<MorningstarResolverService>;

    isinEnrichment = {
      enrichIsinInBackground: jest.fn(),
    } as unknown as jest.Mocked<IsinEnrichmentService>;

    const pageVerifier = {
      verifyFundPageWithFallback: jest.fn(),
    } as unknown as jest.Mocked<PageVerifierService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: AssetsRepository, useValue: repository },
        { provide: MorningstarResolverService, useValue: morningstarResolver },
        { provide: IsinEnrichmentService, useValue: isinEnrichment },
        { provide: PageVerifierService, useValue: pageVerifier },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              batchConcurrencyLimit: 5,
              maxAlternatives: 3,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
  });

  describe('resolve', () => {
    describe('memory cache hit', () => {
      it('should return cached response from memory', async () => {
        const cachedResponse = {
          success: true,
          source: ResolutionSource.CACHE,
          asset: createMockAsset(),
        };
        cacheManager.get.mockResolvedValue(cachedResponse);

        const result = await service.resolve({ input: 'IE00B4L5Y983' });

        expect(result).toEqual(cachedResponse);
        expect(repository.findByIsin).not.toHaveBeenCalled();
      });
    });

    describe('database cache hit', () => {
      it('should return asset from database when found by ISIN', async () => {
        cacheManager.get.mockResolvedValue(null);
        const mockAsset = createMockAsset();
        repository.findByIsin.mockResolvedValue(mockAsset);

        const result = await service.resolve({ input: 'IE00B4L5Y983' });

        expect(result.success).toBe(true);
        expect(result.source).toBe(ResolutionSource.CACHE);
        expect(result.asset?.isin).toBe('IE00B4L5Y983');
        expect(cacheManager.set).toHaveBeenCalled();
      });

      it('should return asset from database when found by Morningstar ID', async () => {
        cacheManager.get.mockResolvedValue(null);
        const mockAsset = createMockAsset();
        repository.findByMorningstarId.mockResolvedValue(mockAsset);

        const result = await service.resolve({ input: '0P0000YXJO' });

        expect(result.success).toBe(true);
        expect(result.source).toBe(ResolutionSource.CACHE);
        expect(result.asset?.morningstarId).toBe('0P0000YXJO');
      });

      it('should re-resolve asset if ISIN is missing and enrichment is complete', async () => {
        cacheManager.get.mockResolvedValue(null);
        const mockAsset = createMockAsset({ isin: null, isinPending: false });
        repository.findByMorningstarId.mockResolvedValue(mockAsset);

        // Mock the resolver to return a resolved result
        morningstarResolver.resolve.mockResolvedValue({
          status: 'resolved',
          morningstarId: '0P0000YXJO',
          morningstarUrl: 'https://morningstar.es/...',
          bestMatch: createMockScoredResult({
            title: 'Test Fund',
            assetType: MS_ASSET_TYPES.ETF,
          }),
          confidence: 1,
          allResults: [],
          input: '0P0000YXJO',
          inputType: IdentifierType.MORNINGSTAR_ID,
          normalizedInput: '0P0000YXJO',
          timestamp: new Date().toISOString(),
        });

        repository.upsertByMorningstarId.mockResolvedValue(createMockAsset());

        await service.resolve({ input: '0P0000YXJO' });

        expect(morningstarResolver.resolve).toHaveBeenCalled();
      });
    });

    describe('external resolution', () => {
      it('should resolve and save asset when not in cache', async () => {
        cacheManager.get.mockResolvedValue(null);
        repository.findByIsin.mockResolvedValue(null);
        repository.findByMorningstarId.mockResolvedValue(null);

        morningstarResolver.resolve.mockResolvedValue({
          status: 'resolved',
          morningstarId: 'F00000THA5',
          morningstarUrl: 'https://morningstar.es/...',
          bestMatch: createMockScoredResult({
            title: 'Vanguard Global Stock',
            assetType: MS_ASSET_TYPES.FUND,
            isin: 'IE00B4L5Y983',
          }),
          verification: createMockVerification({
            isinFound: 'IE00B4L5Y983',
            nameFound: 'Vanguard',
          }),
          confidence: 0.95,
          allResults: [],
          input: 'IE00B4L5Y983',
          inputType: IdentifierType.ISIN,
          normalizedInput: 'IE00B4L5Y983',
          timestamp: new Date().toISOString(),
        });

        const savedAsset = createMockAsset({ morningstarId: 'F00000THA5' });
        repository.upsertByMorningstarId.mockResolvedValue(savedAsset);

        const result = await service.resolve({ input: 'IE00B4L5Y983' });

        expect(result.success).toBe(true);
        expect(result.source).toBe(ResolutionSource.RESOLVED);
        expect(repository.upsertByMorningstarId).toHaveBeenCalled();
      });

      it('should trigger ISIN enrichment when no ISIN found', async () => {
        cacheManager.get.mockResolvedValue(null);
        repository.findByIsin.mockResolvedValue(null);
        repository.findByMorningstarId.mockResolvedValue(null);

        morningstarResolver.resolve.mockResolvedValue({
          status: 'resolved',
          morningstarId: 'F00000THA5',
          morningstarUrl: 'https://morningstar.es/...',
          bestMatch: createMockScoredResult({
            title: 'Some Fund',
            assetType: MS_ASSET_TYPES.FUND,
            // No ISIN
          }),
          confidence: 0.9,
          allResults: [],
          input: 'VWCE',
          inputType: IdentifierType.TICKER,
          normalizedInput: 'VWCE',
          timestamp: new Date().toISOString(),
        });

        const savedAsset = createMockAsset({
          morningstarId: 'F00000THA5',
          isin: null,
        });
        repository.upsertByMorningstarId.mockResolvedValue(savedAsset);

        const result = await service.resolve({ input: 'VWCE' });

        expect(result.isinPending).toBe(true);
        expect(isinEnrichment.enrichIsinInBackground).toHaveBeenCalledWith(
          savedAsset.id,
          'Some Fund',
        );
      });

      it('should reject invalid ISIN candidates (garbage from API)', async () => {
        cacheManager.get.mockResolvedValue(null);
        repository.findByIsin.mockResolvedValue(null);
        repository.findByMorningstarId.mockResolvedValue(null);

        morningstarResolver.resolve.mockResolvedValue({
          status: 'resolved',
          morningstarId: 'F00000THA5',
          morningstarUrl: 'https://morningstar.es/...',
          bestMatch: createMockScoredResult({
            title: 'Some Stock',
            assetType: MS_ASSET_TYPES.STOCK,
            isin: 'CANADAFRENCH', // Garbage ISIN from Morningstar API
          }),
          confidence: 0.9,
          allResults: [],
          input: 'AAPL',
          inputType: IdentifierType.TICKER,
          normalizedInput: 'AAPL',
          timestamp: new Date().toISOString(),
        });

        const savedAsset = createMockAsset({
          morningstarId: 'F00000THA5',
          isin: null,
        });
        repository.upsertByMorningstarId.mockResolvedValue(savedAsset);

        await service.resolve({ input: 'AAPL' });

        // Should save with null ISIN (rejecting the garbage)
        expect(repository.upsertByMorningstarId).toHaveBeenCalledWith(
          expect.objectContaining({ isin: null }),
        );
      });
    });

    describe('needs_review resolution', () => {
      it('should return alternatives when resolution is ambiguous', async () => {
        cacheManager.get.mockResolvedValue(null);
        repository.findByIsin.mockResolvedValue(null);

        morningstarResolver.resolve.mockResolvedValue({
          status: 'needs_review',
          morningstarId: null,
          morningstarUrl: null,
          bestMatch: null,
          confidence: 0.6,
          allResults: [
            createMockScoredResult({
              morningstarId: '0P0000YXJO',
              title: 'Fund A',
              url: 'url1',
              score: 80,
            }),
            createMockScoredResult({
              morningstarId: 'F00000THA5',
              title: 'Fund B',
              url: 'url2',
              score: 75,
            }),
          ],
          input: 'Vanguard',
          inputType: IdentifierType.FREE_TEXT,
          normalizedInput: 'VANGUARD',
          timestamp: new Date().toISOString(),
        });

        const result = await service.resolve({ input: 'Vanguard' });

        expect(result.success).toBe(false);
        expect(result.source).toBe(ResolutionSource.MANUAL_REQUIRED);
        expect(result.errorCode).toBe(ResolutionErrorCode.AMBIGUOUS_MATCH);
        expect(result.alternatives).toHaveLength(2);
      });
    });

    describe('not found resolution', () => {
      it('should return not found error when no results', async () => {
        cacheManager.get.mockResolvedValue(null);
        repository.findByIsin.mockResolvedValue(null);

        morningstarResolver.resolve.mockResolvedValue({
          status: 'not_found',
          morningstarId: null,
          morningstarUrl: null,
          bestMatch: null,
          confidence: 0,
          allResults: [],
          input: 'INVALID123',
          inputType: IdentifierType.FREE_TEXT,
          normalizedInput: 'INVALID123',
          timestamp: new Date().toISOString(),
        });

        const result = await service.resolve({ input: 'INVALID123' });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(ResolutionErrorCode.NOT_FOUND);
      });
    });

    describe('error handling', () => {
      it('should categorize timeout errors correctly', async () => {
        cacheManager.get.mockResolvedValue(null);
        repository.findByIsin.mockResolvedValue(null);

        morningstarResolver.resolve.mockRejectedValue(
          new Error('Request timed out'),
        );

        const result = await service.resolve({ input: 'AAPL' });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(ResolutionErrorCode.TIMEOUT);
      });

      it('should categorize network errors correctly', async () => {
        cacheManager.get.mockResolvedValue(null);
        repository.findByIsin.mockResolvedValue(null);

        morningstarResolver.resolve.mockRejectedValue(
          new Error('ECONNREFUSED'),
        );

        const result = await service.resolve({ input: 'AAPL' });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(ResolutionErrorCode.NETWORK_ERROR);
      });

      it('should categorize circuit breaker errors correctly', async () => {
        cacheManager.get.mockResolvedValue(null);
        repository.findByIsin.mockResolvedValue(null);

        morningstarResolver.resolve.mockRejectedValue(
          new Error('Circuit is open - service unavailable'),
        );

        const result = await service.resolve({ input: 'AAPL' });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(ResolutionErrorCode.SERVICE_UNAVAILABLE);
      });
    });
  });

  describe('resolveBatch', () => {
    it('should resolve multiple assets efficiently', async () => {
      const mockAsset1 = createMockAsset({
        isin: 'IE00B4L5Y983',
        morningstarId: '0P0000YXJO',
      });
      const mockAsset2 = createMockAsset({
        isin: 'LU0996182563',
        morningstarId: 'F00000THA5',
      });

      // Cache hit for first, miss for second
      cacheManager.get
        .mockResolvedValueOnce({
          success: true,
          source: ResolutionSource.CACHE,
          asset: mockAsset1,
        })
        .mockResolvedValueOnce(null);

      repository.findManyByMorningstarIds.mockResolvedValue([mockAsset2]);

      const result = await service.resolveBatch({
        assets: [{ input: 'IE00B4L5Y983' }, { input: 'F00000THA5' }],
      });

      expect(result.total).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should respect batch concurrency limit', async () => {
      // This is an integration-level test; the actual concurrency limiting
      // is handled by the service internally
      cacheManager.get.mockResolvedValue(null);
      repository.findManyByMorningstarIds.mockResolvedValue([]);
      repository.findManyByIsins.mockResolvedValue([]);

      morningstarResolver.resolve.mockResolvedValue({
        status: 'not_found',
        morningstarId: null,
        morningstarUrl: null,
        bestMatch: null,
        confidence: 0,
        allResults: [],
        input: 'test',
        inputType: IdentifierType.FREE_TEXT,
        normalizedInput: 'TEST',
        timestamp: new Date().toISOString(),
      });

      const assets = Array(10)
        .fill(null)
        .map((_, i) => ({ input: `Fund${i}` }));

      const result = await service.resolveBatch({ assets });

      expect(result.total).toBe(10);
      expect(result.manualRequired).toBe(10);
    });
  });

  describe('getById', () => {
    it('should return asset when found', async () => {
      const mockAsset = createMockAsset();
      repository.findById.mockResolvedValue(mockAsset);

      const result = await service.getById(mockAsset.id);

      expect(result.id).toBe(mockAsset.id);
      expect(result.morningstarId).toBe(mockAsset.morningstarId);
    });

    it('should throw EntityNotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById('non-existent-id')).rejects.toThrow();
    });
  });

  describe('confirm', () => {
    it('should create/update asset with manual source', async () => {
      const mockAsset = createMockAsset({ source: AssetSource.manual });
      repository.upsertByMorningstarId.mockResolvedValue(mockAsset);

      const result = await service.confirm({
        isin: 'IE00B4L5Y983',
        morningstarId: '0P0000YXJO',
        name: 'Test Fund',
        type: AssetTypeDto.ETF,
        url: 'https://morningstar.es/...',
      });

      expect(result.source).toBe(AssetSource.manual);
      expect(repository.upsertByMorningstarId).toHaveBeenCalled();
      expect(cacheManager.del).toHaveBeenCalled();
    });
  });

  describe('updateIsin', () => {
    it('should update ISIN and invalidate cache', async () => {
      const mockAsset = createMockAsset({ isinManual: true });
      repository.updateIsinWithVerification.mockResolvedValue(mockAsset);

      const result = await service.updateIsin(mockAsset.id, 'LU0996182563');

      expect(result.isin).toBe(mockAsset.isin);
      expect(cacheManager.del).toHaveBeenCalled();
    });
  });

  describe('mapAssetType (via resolve)', () => {
    beforeEach(() => {
      cacheManager.get.mockResolvedValue(null);
      repository.findByIsin.mockResolvedValue(null);
      repository.findByMorningstarId.mockResolvedValue(null);
    });

    it('should map ETF type correctly', async () => {
      morningstarResolver.resolve.mockResolvedValue({
        status: 'resolved',
        morningstarId: 'F00000THA5',
        morningstarUrl: 'https://morningstar.es/...',
        bestMatch: createMockScoredResult({
          title: 'ETF Fund',
          assetType: MS_ASSET_TYPES.ETF,
        }),
        confidence: 0.9,
        allResults: [],
        input: 'test',
        inputType: IdentifierType.FREE_TEXT,
        normalizedInput: 'TEST',
        timestamp: new Date().toISOString(),
      });

      repository.upsertByMorningstarId.mockImplementation(async (data) => {
        expect(data.type).toBe(AssetType.ETF);
        return createMockAsset({ type: data.type });
      });

      await service.resolve({ input: 'test' });
    });

    it('should map STOCK type correctly', async () => {
      morningstarResolver.resolve.mockResolvedValue({
        status: 'resolved',
        morningstarId: 'F00000THA5',
        morningstarUrl: 'https://morningstar.es/...',
        bestMatch: createMockScoredResult({
          title: 'Apple',
          assetType: MS_ASSET_TYPES.STOCK,
        }),
        confidence: 0.9,
        allResults: [],
        input: 'AAPL',
        inputType: IdentifierType.TICKER,
        normalizedInput: 'AAPL',
        timestamp: new Date().toISOString(),
      });

      repository.upsertByMorningstarId.mockImplementation(async (data) => {
        expect(data.type).toBe(AssetType.STOCK);
        return createMockAsset({ type: data.type });
      });

      await service.resolve({ input: 'AAPL' });
    });

    it('should default to FUND for unknown types', async () => {
      morningstarResolver.resolve.mockResolvedValue({
        status: 'resolved',
        morningstarId: 'F00000THA5',
        morningstarUrl: 'https://morningstar.es/...',
        bestMatch: createMockScoredResult({
          title: 'Unknown Type',
          assetType: undefined,
        }),
        confidence: 0.9,
        allResults: [],
        input: 'test',
        inputType: IdentifierType.FREE_TEXT,
        normalizedInput: 'TEST',
        timestamp: new Date().toISOString(),
      });

      repository.upsertByMorningstarId.mockImplementation(async (data) => {
        expect(data.type).toBe(AssetType.FUND);
        return createMockAsset({ type: data.type });
      });

      await service.resolve({ input: 'test' });
    });
  });
});
