import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { HttpClientService } from '../common/http';
import { ComponentStatus, HealthStatus } from './dto/health-response.dto';
import { CircuitState } from '../common/http';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: jest.Mocked<Pick<PrismaService, '$queryRaw'>>;
  let httpClient: jest.Mocked<Pick<HttpClientService, 'getAllCircuitStatuses'>>;

  beforeEach(async () => {
    const mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    const mockHttpClient = {
      getAllCircuitStatuses: jest.fn().mockReturnValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: HttpClientService, useValue: mockHttpClient },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
    prisma = module.get(PrismaService);
    httpClient = module.get(HttpClientService);
  });

  describe('check', () => {
    it('should return OK and database CONNECTED when DB query succeeds', async () => {
      const result = await service.check();

      expect(result.status).toBe(HealthStatus.OK);
      expect(result.database).toBe(ComponentStatus.CONNECTED);
      expect(result.timestamp).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.databaseResponseTimeMs).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return DEGRADED and error when DB query fails', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(
        new Error('Connection refused'),
      );

      const result = await service.check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.database).toBe(ComponentStatus.DISCONNECTED);
      expect(result.error).toBe('Connection refused');
      expect(result.databaseResponseTimeMs).toBeDefined();
    });

    it('should return DEGRADED when circuit breaker has open circuits', async () => {
      (httpClient.getAllCircuitStatuses as jest.Mock).mockReturnValue(
        new Map([
          [
            'example.com',
            {
              state: CircuitState.OPEN,
              failureCount: 5,
              successCount: 0,
              lastFailureTime: 0,
              lastStateChange: 0,
            },
          ],
        ]),
      );

      const result = await service.check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.database).toBe(ComponentStatus.CONNECTED);
      expect(result.circuitBreaker?.openCircuits).toBe(1);
    });
  });

  describe('liveness', () => {
    it('should return status ok and timestamp', () => {
      const result = service.liveness();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });
  });
});
