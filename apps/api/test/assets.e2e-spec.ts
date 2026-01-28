import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  NotFoundException,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AssetsController } from '../src/assets/assets.controller';
import { AssetsService } from '../src/assets/assets.service';
import { ResolutionSource, ResolutionErrorCode } from '../src/assets/types';

// Mock the AssetsService to avoid database dependencies
const mockAssetsService = {
  resolve: jest.fn(),
  resolveBatch: jest.fn(),
  getById: jest.fn(),
  confirm: jest.fn(),
  updateIsin: jest.fn(),
};

describe('AssetsController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AssetsController],
      providers: [{ provide: AssetsService, useValue: mockAssetsService }],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Configure the same validation pipe as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /assets/resolve', () => {
    describe('successful resolution', () => {
      it('should resolve ISIN successfully', async () => {
        const mockResponse = {
          success: true,
          source: ResolutionSource.CACHE,
          asset: {
            id: '123',
            isin: 'IE00B4L5Y983',
            morningstarId: '0P0000YXJO',
            name: 'Test ETF',
            type: 'ETF',
            url: 'https://morningstar.es/...',
            source: 'web_search',
          },
        };
        mockAssetsService.resolve.mockResolvedValue(mockResponse);

        const response = await request(app.getHttpServer())
          .post('/assets/resolve')
          .send({ input: 'IE00B4L5Y983' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.source).toBe(ResolutionSource.CACHE);
        expect(response.body.asset.isin).toBe('IE00B4L5Y983');
      });

      it('should resolve Morningstar ID successfully', async () => {
        mockAssetsService.resolve.mockResolvedValue({
          success: true,
          source: ResolutionSource.RESOLVED,
          asset: { morningstarId: '0P0000YXJO' },
        });

        const response = await request(app.getHttpServer())
          .post('/assets/resolve')
          .send({ input: '0P0000YXJO' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(mockAssetsService.resolve).toHaveBeenCalledWith(
          expect.objectContaining({ input: '0P0000YXJO' }),
        );
      });

      it('should accept optional assetType hint', async () => {
        mockAssetsService.resolve.mockResolvedValue({
          success: true,
          source: ResolutionSource.RESOLVED,
          asset: { type: 'ETF' },
        });

        await request(app.getHttpServer())
          .post('/assets/resolve')
          .send({ input: 'IWDA', assetType: 'ETF' })
          .expect(200);

        expect(mockAssetsService.resolve).toHaveBeenCalledWith({
          input: 'IWDA',
          assetType: 'ETF',
        });
      });
    });

    describe('validation errors', () => {
      it('should return 400 when input is missing', async () => {
        const response = await request(app.getHttpServer())
          .post('/assets/resolve')
          .send({})
          .expect(400);

        // Message can be a string or array depending on validation errors
        const messages = Array.isArray(response.body.message)
          ? response.body.message.join(' ')
          : response.body.message;
        expect(messages).toContain('input');
      });

      it('should return 400 when input is empty string', async () => {
        const response = await request(app.getHttpServer())
          .post('/assets/resolve')
          .send({ input: '' })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when input exceeds max length', async () => {
        const longInput = 'A'.repeat(100); // Max is 50

        const response = await request(app.getHttpServer())
          .post('/assets/resolve')
          .send({ input: longInput })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 for invalid assetType', async () => {
        const response = await request(app.getHttpServer())
          .post('/assets/resolve')
          .send({ input: 'AAPL', assetType: 'INVALID_TYPE' })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 for non-whitelisted properties', async () => {
        const response = await request(app.getHttpServer())
          .post('/assets/resolve')
          .send({ input: 'AAPL', unknownProperty: 'value' })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });
    });

    describe('resolution failures', () => {
      it('should return success=false with alternatives for ambiguous match', async () => {
        mockAssetsService.resolve.mockResolvedValue({
          success: false,
          source: ResolutionSource.MANUAL_REQUIRED,
          errorCode: ResolutionErrorCode.AMBIGUOUS_MATCH,
          alternatives: [
            { morningstarId: '0P0000YXJO', name: 'Fund A', url: 'url1' },
            { morningstarId: 'F00000THA5', name: 'Fund B', url: 'url2' },
          ],
          error: 'Asset found but needs confirmation',
        });

        const response = await request(app.getHttpServer())
          .post('/assets/resolve')
          .send({ input: 'Vanguard' })
          .expect(200); // Note: 200 OK, but success=false

        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBe(
          ResolutionErrorCode.AMBIGUOUS_MATCH,
        );
        expect(response.body.alternatives).toHaveLength(2);
      });

      it('should return NOT_FOUND error code when asset not found', async () => {
        mockAssetsService.resolve.mockResolvedValue({
          success: false,
          source: ResolutionSource.MANUAL_REQUIRED,
          errorCode: ResolutionErrorCode.NOT_FOUND,
          error: 'Asset not found',
        });

        const response = await request(app.getHttpServer())
          .post('/assets/resolve')
          .send({ input: 'INVALID123' })
          .expect(200);

        expect(response.body.success).toBe(false);
        expect(response.body.errorCode).toBe(ResolutionErrorCode.NOT_FOUND);
      });
    });
  });

  describe('POST /assets/resolve/batch', () => {
    describe('successful batch resolution', () => {
      it('should resolve multiple assets', async () => {
        mockAssetsService.resolveBatch.mockResolvedValue({
          total: 2,
          resolved: 2,
          manualRequired: 0,
          results: [
            {
              input: 'IE00B4L5Y983',
              result: { success: true, source: ResolutionSource.CACHE },
            },
            {
              input: '0P0000YXJO',
              result: { success: true, source: ResolutionSource.RESOLVED },
            },
          ],
        });

        const response = await request(app.getHttpServer())
          .post('/assets/resolve/batch')
          .send({
            assets: [{ input: 'IE00B4L5Y983' }, { input: '0P0000YXJO' }],
          })
          .expect(200);

        expect(response.body.total).toBe(2);
        expect(response.body.resolved).toBe(2);
        expect(response.body.results).toHaveLength(2);
      });
    });

    describe('validation errors', () => {
      it('should return 400 when assets array is empty', async () => {
        const response = await request(app.getHttpServer())
          .post('/assets/resolve/batch')
          .send({ assets: [] })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when assets exceeds max batch size (20)', async () => {
        const assets = Array(25)
          .fill(null)
          .map((_, i) => ({ input: `FUND${i}` }));

        const response = await request(app.getHttpServer())
          .post('/assets/resolve/batch')
          .send({ assets })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when asset in batch has empty input', async () => {
        const response = await request(app.getHttpServer())
          .post('/assets/resolve/batch')
          .send({ assets: [{ input: '' }] })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when assets is not an array', async () => {
        const response = await request(app.getHttpServer())
          .post('/assets/resolve/batch')
          .send({ assets: 'not an array' })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });
    });
  });

  describe('GET /assets/:id', () => {
    describe('successful retrieval', () => {
      it('should return asset by UUID', async () => {
        const mockAsset = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          isin: 'IE00B4L5Y983',
          morningstarId: '0P0000YXJO',
          name: 'Test ETF',
          type: 'ETF',
        };
        mockAssetsService.getById.mockResolvedValue(mockAsset);

        const response = await request(app.getHttpServer())
          .get('/assets/123e4567-e89b-12d3-a456-426614174000')
          .expect(200);

        expect(response.body.id).toBe(mockAsset.id);
        expect(response.body.morningstarId).toBe(mockAsset.morningstarId);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID format', async () => {
        const response = await request(app.getHttpServer())
          .get('/assets/not-a-uuid')
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });
    });

    describe('not found', () => {
      it('should return 404 when asset not found', async () => {
        mockAssetsService.getById.mockRejectedValue(
          new NotFoundException('Asset not found'),
        );

        await request(app.getHttpServer())
          .get('/assets/123e4567-e89b-12d3-a456-426614174000')
          .expect(404);
      });
    });
  });

  describe('POST /assets/confirm', () => {
    describe('successful confirmation', () => {
      it('should confirm asset with required fields', async () => {
        const mockAsset = {
          id: '123',
          isin: 'IE00B4L5Y983',
          morningstarId: '0P0000YXJO',
          name: 'Test Fund',
          type: 'ETF',
          url: 'https://morningstar.es/...',
          source: 'manual',
        };
        mockAssetsService.confirm.mockResolvedValue(mockAsset);

        const response = await request(app.getHttpServer())
          .post('/assets/confirm')
          .send({
            isin: 'IE00B4L5Y983',
            morningstarId: '0P0000YXJO',
            name: 'Test Fund',
            type: 'ETF',
            url: 'https://morningstar.es/fund',
          })
          .expect(201);

        expect(response.body.source).toBe('manual');
      });
    });

    describe('validation errors', () => {
      it('should return 400 when required fields are missing', async () => {
        const response = await request(app.getHttpServer())
          .post('/assets/confirm')
          .send({ isin: 'IE00B4L5Y983' }) // Missing other required fields
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 for invalid ISIN format', async () => {
        const response = await request(app.getHttpServer())
          .post('/assets/confirm')
          .send({
            isin: 'INVALID', // Invalid ISIN
            morningstarId: '0P0000YXJO',
            name: 'Test',
            type: 'ETF',
            url: 'https://example.com',
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });
    });
  });

  describe('PATCH /assets/:id/isin', () => {
    describe('successful update', () => {
      it('should update ISIN for asset', async () => {
        const mockAsset = {
          id: '123e4567-e89b-12d3-a456-426614174000',
          isin: 'LU0996182563',
          morningstarId: '0P0000YXJO',
        };
        mockAssetsService.updateIsin.mockResolvedValue(mockAsset);

        const response = await request(app.getHttpServer())
          .patch('/assets/123e4567-e89b-12d3-a456-426614174000/isin')
          .send({ isin: 'LU0996182563' })
          .expect(200);

        expect(response.body.isin).toBe('LU0996182563');
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid UUID', async () => {
        await request(app.getHttpServer())
          .patch('/assets/not-a-uuid/isin')
          .send({ isin: 'IE00B4L5Y983' })
          .expect(400);
      });

      it('should return 400 for invalid ISIN format', async () => {
        const response = await request(app.getHttpServer())
          .patch('/assets/123e4567-e89b-12d3-a456-426614174000/isin')
          .send({ isin: 'INVALID' })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when ISIN is missing', async () => {
        const response = await request(app.getHttpServer())
          .patch('/assets/123e4567-e89b-12d3-a456-426614174000/isin')
          .send({})
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });
    });
  });
});
