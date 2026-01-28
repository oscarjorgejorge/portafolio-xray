import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { XRayController } from '../src/xray/xray.controller';
import { XRayService } from '../src/xray/xray.service';

// Mock the XRayService to avoid database dependencies
const mockXRayService = {
  generate: jest.fn(),
};

describe('XRayController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [XRayController],
      providers: [{ provide: XRayService, useValue: mockXRayService }],
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

  describe('POST /xray/generate', () => {
    describe('successful generation', () => {
      it('should generate X-Ray URL with valid portfolio', async () => {
        const mockResponse = {
          morningstarUrl: 'https://lt.morningstar.com/...',
          shareableUrl: '/xray?assets=...',
        };
        mockXRayService.generate.mockResolvedValue(mockResponse);

        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [
              { morningstarId: '0P0000YXJO', weight: 60 },
              { morningstarId: 'F00000THA5', weight: 40 },
            ],
          })
          .expect(200);

        expect(response.body.morningstarUrl).toBeDefined();
        expect(response.body.shareableUrl).toBeDefined();
      });

      it('should accept single asset with 100% weight', async () => {
        mockXRayService.generate.mockResolvedValue({
          morningstarUrl: 'https://lt.morningstar.com/...',
          shareableUrl: '/xray?assets=...',
        });

        await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
          })
          .expect(200);

        expect(mockXRayService.generate).toHaveBeenCalled();
      });

      it('should accept weights with decimals summing to 100', async () => {
        mockXRayService.generate.mockResolvedValue({
          morningstarUrl: 'https://...',
          shareableUrl: '/xray?...',
        });

        await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [
              { morningstarId: '0P0000YXJO', weight: 33.33 },
              { morningstarId: 'F00000THA5', weight: 33.33 },
              { morningstarId: 'F000016RL3', weight: 33.34 },
            ],
          })
          .expect(200);
      });
    });

    describe('validation errors - weight total', () => {
      it('should return 400 when total weight is less than 100', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [
              { morningstarId: '0P0000YXJO', weight: 40 },
              { morningstarId: 'F00000THA5', weight: 30 },
            ],
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
        // Message can be a string or array
        const messages = Array.isArray(response.body.message)
          ? response.body.message.join(' ')
          : response.body.message;
        expect(messages).toContain('100');
      });

      it('should return 400 when total weight exceeds 100', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [
              { morningstarId: '0P0000YXJO', weight: 60 },
              { morningstarId: 'F00000THA5', weight: 50 },
            ],
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });
    });

    describe('validation errors - duplicate IDs', () => {
      it('should return 400 when duplicate morningstarIds exist', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [
              { morningstarId: '0P0000YXJO', weight: 50 },
              { morningstarId: '0P0000YXJO', weight: 50 }, // Duplicate
            ],
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
        // Message can be a string or array
        const messages = Array.isArray(response.body.message)
          ? response.body.message.join(' ')
          : response.body.message;
        expect(messages.toLowerCase()).toContain('unique');
      });
    });

    describe('validation errors - assets array', () => {
      it('should return 400 when assets array is empty', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({ assets: [] })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when assets is missing', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({})
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when assets is not an array', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({ assets: 'not an array' })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });
    });

    describe('validation errors - individual asset fields', () => {
      it('should return 400 when morningstarId is missing', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [{ weight: 100 }], // Missing morningstarId
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when morningstarId is empty', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [{ morningstarId: '', weight: 100 }],
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when weight is missing', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [{ morningstarId: '0P0000YXJO' }], // Missing weight
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when weight is negative', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [{ morningstarId: '0P0000YXJO', weight: -10 }],
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when weight exceeds 100', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [{ morningstarId: '0P0000YXJO', weight: 150 }],
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 when morningstarId exceeds max length', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [{ morningstarId: 'A'.repeat(50), weight: 100 }],
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });
    });

    describe('validation errors - non-whitelisted properties', () => {
      it('should return 400 for non-whitelisted properties at root level', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
            unknownProperty: 'value',
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });

      it('should return 400 for non-whitelisted properties in asset object', async () => {
        const response = await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [
              {
                morningstarId: '0P0000YXJO',
                weight: 100,
                unknownField: 'value',
              },
            ],
          })
          .expect(400);

        expect(response.body.statusCode).toBe(400);
      });
    });

    describe('input transformation', () => {
      it('should transform morningstarId to uppercase', async () => {
        mockXRayService.generate.mockResolvedValue({
          morningstarUrl: 'https://...',
          shareableUrl: '/xray?...',
        });

        await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [{ morningstarId: '0p0000yxjo', weight: 100 }], // lowercase
          })
          .expect(200);

        expect(mockXRayService.generate).toHaveBeenCalledWith({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }], // uppercase
        });
      });

      it('should trim whitespace from morningstarId', async () => {
        mockXRayService.generate.mockResolvedValue({
          morningstarUrl: 'https://...',
          shareableUrl: '/xray?...',
        });

        await request(app.getHttpServer())
          .post('/xray/generate')
          .send({
            assets: [{ morningstarId: '  0P0000YXJO  ', weight: 100 }],
          })
          .expect(200);

        expect(mockXRayService.generate).toHaveBeenCalledWith({
          assets: [{ morningstarId: '0P0000YXJO', weight: 100 }],
        });
      });
    });
  });
});
