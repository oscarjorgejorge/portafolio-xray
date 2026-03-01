import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';
import {
  HealthStatus,
  ComponentStatus,
} from '../src/health/dto/health-response.dto';

const mockHealthService = {
  check: jest.fn(),
  liveness: jest.fn(),
};

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return readiness status with database and version', async () => {
      mockHealthService.check.mockResolvedValue({
        status: HealthStatus.OK,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: ComponentStatus.CONNECTED,
        databaseResponseTimeMs: 2,
      });

      const res = await request(app.getHttpServer()).get('/health').expect(200);

      expect(res.body.status).toBe(HealthStatus.OK);
      expect(res.body.database).toBe(ComponentStatus.CONNECTED);
      expect(res.body.version).toBeDefined();
      expect(mockHealthService.check).toHaveBeenCalled();
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      mockHealthService.liveness.mockReturnValue({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(mockHealthService.liveness).toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness (same as GET /health)', async () => {
      mockHealthService.check.mockResolvedValue({
        status: HealthStatus.OK,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: ComponentStatus.CONNECTED,
      });

      await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(mockHealthService.check).toHaveBeenCalled();
    });
  });
});
