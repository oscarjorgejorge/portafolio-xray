import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpClientService } from './http-client.service';
import {
  CircuitState,
  HttpErrorType,
  type CircuitBreakerState,
} from './http-client.types';

describe('HttpClientService', () => {
  let service: HttpClientService;
  let configService: {
    get: jest.Mock;
  };

  const domain = 'api.example.com';
  const baseUrl = `https://${domain}/resource`;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'http') {
          return {
            defaultTimeoutMs: 5000,
          };
        }
        if (key === 'circuitBreaker') {
          return {
            failureThreshold: 2,
            resetTimeoutMs: 1000,
            successThreshold: 1,
          };
        }
        return undefined;
      }),
    };

    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpClientService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<HttpClientService>(HttpClientService);
  });

  describe('request success', () => {
    it('should perform GET and return parsed JSON data', async () => {
      const jsonResponse = { ok: true };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => jsonResponse,
        text: async () => JSON.stringify(jsonResponse),
      } as Response);

      const result = await service.get<typeof jsonResponse>(baseUrl);

      expect(global.fetch).toHaveBeenCalledWith(
        baseUrl,
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result.ok).toBe(true);
      expect(result.data).toEqual(jsonResponse);
      const circuit = service.getCircuitStatus(domain) as CircuitBreakerState;
      expect(circuit.state).toBe(CircuitState.CLOSED);
      expect(circuit.failureCount).toBe(0);
    });
  });

  describe('HTTP error handling', () => {
    it('should return HTTP_ERROR for non-2xx responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      } as Response);

      const result = await service.get(baseUrl);

      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(result.error?.type).toBe(HttpErrorType.HTTP_ERROR);
      const circuit = service.getCircuitStatus(domain) as CircuitBreakerState;
      expect(circuit.failureCount).toBeGreaterThan(0);
      expect(circuit.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('network and timeout errors', () => {
    it('should categorize network errors and retry when configured', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new TypeError('getaddrinfo ENOTFOUND'),
      );

      const result = await (service as any).get(baseUrl, {
        retries: 1,
        retryDelay: 10,
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(false);
      expect(result.error?.type).toBe(HttpErrorType.NETWORK);
    });

    it('should categorize timeout errors correctly', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new DOMException('Timeout', 'TimeoutError'),
      );

      const result = await service.get(baseUrl);

      expect(result.ok).toBe(false);
      expect(result.error?.type).toBe(HttpErrorType.TIMEOUT);
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after consecutive failures and block further calls', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new TypeError('ECONNREFUSED'),
      );

      await service.get(baseUrl);
      await service.get(baseUrl);

      const statusAfterFailures = service.getCircuitStatus(
        domain,
      ) as CircuitBreakerState;
      expect(statusAfterFailures.state).toBe(CircuitState.OPEN);

      const blocked = await service.get(baseUrl);
      expect(blocked.ok).toBe(false);
      expect(blocked.error?.type).toBe(HttpErrorType.CIRCUIT_OPEN);
    });

    it('should transition from OPEN to HALF_OPEN after reset timeout and close on success', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new TypeError('ECONNREFUSED'),
      );

      await service.get(baseUrl);
      await service.get(baseUrl);

      const now = Date.now();
      const statusOpen = service.getCircuitStatus(
        domain,
      ) as CircuitBreakerState;
      statusOpen.lastFailureTime = now - 2000;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ ok: true }),
        text: async () => '{"ok":true}',
      } as Response);

      const halfOpenResult = await service.get(baseUrl);
      expect(halfOpenResult.ok).toBe(true);

      const statusClosed = service.getCircuitStatus(
        domain,
      ) as CircuitBreakerState;
      expect(statusClosed.state).toBe(CircuitState.CLOSED);
      expect(statusClosed.failureCount).toBe(0);
    });
  });
});
