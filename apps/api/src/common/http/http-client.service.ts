import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HttpRequestOptions,
  HttpResponse,
  HttpClientConfig,
  ResponseType,
  HttpErrorType,
  HttpError,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
} from './http-client.types';
import { IHttpClient } from '../interfaces';
import { createContextLogger } from '../logger';
import type { AppConfig } from '../../config';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

/**
 * Centralized HTTP client service with timeout, retry, circuit breaker, and logging support.
 * Abstracts fetch calls for better testability and consistent error handling.
 *
 * Circuit Breaker Pattern:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: After failureThreshold failures, rejects requests immediately for resetTimeoutMs
 * - HALF_OPEN: After timeout, allows limited requests to test if service recovered
 *
 * Error handling:
 * - All errors are captured and included in the response.error field
 * - The response.ok field indicates success (true) or failure (false)
 * - Callers should always check response.ok before using response.data
 * - Error types help categorize failures for appropriate handling
 */
@Injectable()
export class HttpClientService implements IHttpClient {
  private readonly logger = createContextLogger(HttpClientService.name);
  private readonly config: HttpClientConfig;
  private readonly circuitConfig: CircuitBreakerConfig;

  constructor(configService: ConfigService<AppConfig, true>) {
    const httpConfig = configService.get('http', { infer: true });
    const circuitBreakerConfig = configService.get('circuitBreaker', {
      infer: true,
    });

    this.config = {
      defaultTimeout: httpConfig.defaultTimeoutMs,
      defaultHeaders: DEFAULT_HEADERS,
      enableLogging: true,
    };

    this.circuitConfig = {
      failureThreshold: circuitBreakerConfig.failureThreshold,
      resetTimeoutMs: circuitBreakerConfig.resetTimeoutMs,
      successThreshold: circuitBreakerConfig.successThreshold,
    };

    this.logger.log(
      `HTTP client configured: timeout=${this.config.defaultTimeout}ms, ` +
        `circuit breaker (failures=${this.circuitConfig.failureThreshold}, ` +
        `reset=${this.circuitConfig.resetTimeoutMs}ms)`,
    );
  }

  /**
   * Circuit breaker state per domain
   * Key: domain (e.g., "morningstar.com")
   */
  private readonly circuits = new Map<string, CircuitBreakerState>();

  /**
   * Perform a GET request
   */
  async get<T = unknown>(
    url: string,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, 'GET', options);
  }

  /**
   * Perform a POST request
   */
  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, 'POST', options, body);
  }

  /**
   * Core request method with timeout, retry, circuit breaker, and error handling
   */
  private async request<T>(
    url: string,
    method: 'GET' | 'POST',
    options?: HttpRequestOptions,
    body?: unknown,
  ): Promise<HttpResponse<T>> {
    const domain = this.extractDomain(url);

    // Check circuit breaker state
    const circuitCheck = this.checkCircuit(domain);
    if (!circuitCheck.allowed) {
      this.logger.warn(
        `[CIRCUIT] Request blocked for ${domain} - circuit is ${circuitCheck.state}`,
      );
      return {
        data: null,
        status: 0,
        ok: false,
        error: {
          type: HttpErrorType.CIRCUIT_OPEN,
          message: `Circuit breaker is open for ${domain}. Service temporarily unavailable.`,
        },
      };
    }

    const {
      headers = {},
      timeout = this.config.defaultTimeout,
      responseType = 'json',
      retries = 0,
      retryDelay = 1000,
    } = options ?? {};

    const mergedHeaders = this.mergeHeaders(headers, responseType);

    let attempts = 0;
    const maxAttempts = retries + 1;
    let lastError: HttpError | undefined;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        if (this.config.enableLogging) {
          this.logger.debug(
            `[HTTP] ${method} ${url} (attempt ${attempts}/${maxAttempts})`,
          );
        }

        const response = await fetch(url, {
          method,
          headers: mergedHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeout),
        });

        // Handle non-2xx responses with detailed error info
        if (!response.ok) {
          const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          this.logger.warn(
            `[HTTP] ${method} ${url} returned ${response.status}`,
          );

          // 5xx errors count as failures for circuit breaker
          if (response.status >= 500) {
            this.recordFailure(domain);
          }

          return {
            data: null,
            status: response.status,
            ok: false,
            headers: response.headers,
            error: {
              type: HttpErrorType.HTTP_ERROR,
              message: errorMessage,
            },
          };
        }

        // Parse successful response
        const { data, parseError } = await this.parseResponse<T>(
          response,
          responseType,
        );

        if (parseError) {
          this.logger.warn(
            `[HTTP] ${method} ${url} parse error: ${parseError.message}`,
          );
          return {
            data: null,
            status: response.status,
            ok: false,
            headers: response.headers,
            error: parseError,
          };
        }

        // Success - record it for circuit breaker
        this.recordSuccess(domain);

        return {
          data,
          status: response.status,
          ok: true,
          headers: response.headers,
        };
      } catch (error) {
        lastError = this.categorizeError(error);

        // Record failure for circuit breaker (network/timeout errors)
        this.recordFailure(domain);

        if (this.isRetryableError(error) && attempts < maxAttempts) {
          this.logger.warn(
            `[HTTP] ${method} ${url} failed (attempt ${attempts}): ${lastError.message}, retrying in ${retryDelay}ms...`,
          );
          await this.delay(retryDelay);
        } else {
          this.logger.error(
            `[HTTP] ${method} ${url} failed after ${attempts} attempt(s): ${lastError.message}`,
          );
        }
      }
    }

    // All retries exhausted - return error response
    return {
      data: null,
      status: 0,
      ok: false,
      error: lastError ?? {
        type: HttpErrorType.UNKNOWN,
        message: 'Request failed for unknown reason',
      },
    };
  }

  /**
   * Parse response based on expected type
   * Returns both data and potential parse error for proper error handling
   */
  private async parseResponse<T>(
    response: Response,
    responseType: ResponseType,
  ): Promise<{ data: T | null; parseError?: HttpError }> {
    try {
      switch (responseType) {
        case 'json':
          return { data: (await response.json()) as T };
        case 'text':
        case 'html':
          return { data: (await response.text()) as unknown as T };
        default:
          return { data: (await response.text()) as unknown as T };
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? `Failed to parse response as ${responseType}: ${error.message}`
          : `Failed to parse response as ${responseType}`;

      return {
        data: null,
        parseError: {
          type: HttpErrorType.PARSE,
          message,
          cause: error instanceof Error ? error : undefined,
        },
      };
    }
  }

  /**
   * Categorize error into appropriate HttpErrorType
   */
  private categorizeError(error: unknown): HttpError {
    if (error instanceof TypeError) {
      // Network errors (DNS, connection refused, etc.)
      return {
        type: HttpErrorType.NETWORK,
        message: `Network error: ${error.message}`,
        cause: error,
      };
    }

    if (error instanceof DOMException) {
      if (error.name === 'TimeoutError') {
        return {
          type: HttpErrorType.TIMEOUT,
          message: 'Request timed out',
          cause: error,
        };
      }
      if (error.name === 'AbortError') {
        return {
          type: HttpErrorType.ABORT,
          message: 'Request was aborted',
          cause: error,
        };
      }
    }

    // Unknown error type
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      type: HttpErrorType.UNKNOWN,
      message,
      cause: error instanceof Error ? error : undefined,
    };
  }

  /**
   * Merge custom headers with defaults
   */
  private mergeHeaders(
    customHeaders: Record<string, string>,
    responseType: ResponseType,
  ): Record<string, string> {
    const acceptHeader =
      responseType === 'json'
        ? 'application/json, text/plain, */*'
        : 'text/html,application/xhtml+xml';

    return {
      ...this.config.defaultHeaders,
      Accept: acceptHeader,
      ...customHeaders,
    };
  }

  /**
   * Check if error is retryable (network issues, timeouts)
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof TypeError) {
      // Network errors
      return true;
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return true;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return true;
    }
    return false;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== Circuit Breaker Methods ====================

  /**
   * Extract domain from URL for circuit breaker tracking
   */
  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get or create circuit breaker state for a domain
   */
  private getCircuit(domain: string): CircuitBreakerState {
    let circuit = this.circuits.get(domain);
    if (!circuit) {
      circuit = {
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        lastStateChange: Date.now(),
      };
      this.circuits.set(domain, circuit);
    }
    return circuit;
  }

  /**
   * Check if request should be allowed based on circuit state
   */
  private checkCircuit(domain: string): {
    allowed: boolean;
    state: CircuitState;
  } {
    const circuit = this.getCircuit(domain);
    const now = Date.now();

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return { allowed: true, state: circuit.state };

      case CircuitState.OPEN:
        // Check if reset timeout has passed
        if (
          now - circuit.lastFailureTime >=
          this.circuitConfig.resetTimeoutMs
        ) {
          // Transition to half-open
          circuit.state = CircuitState.HALF_OPEN;
          circuit.successCount = 0;
          circuit.lastStateChange = now;
          this.logger.log(
            `[CIRCUIT] ${domain}: OPEN -> HALF_OPEN (testing recovery)`,
          );
          return { allowed: true, state: circuit.state };
        }
        return { allowed: false, state: circuit.state };

      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        return { allowed: true, state: circuit.state };

      default:
        return { allowed: true, state: CircuitState.CLOSED };
    }
  }

  /**
   * Record a successful request for circuit breaker
   */
  private recordSuccess(domain: string): void {
    const circuit = this.getCircuit(domain);

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successCount++;
      if (circuit.successCount >= this.circuitConfig.successThreshold) {
        // Enough successes - close the circuit
        circuit.state = CircuitState.CLOSED;
        circuit.failureCount = 0;
        circuit.successCount = 0;
        circuit.lastStateChange = Date.now();
        this.logger.log(`[CIRCUIT] ${domain}: HALF_OPEN -> CLOSED (recovered)`);
      }
    } else if (circuit.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      circuit.failureCount = 0;
    }
  }

  /**
   * Record a failed request for circuit breaker
   */
  private recordFailure(domain: string): void {
    const circuit = this.getCircuit(domain);
    const now = Date.now();

    circuit.failureCount++;
    circuit.lastFailureTime = now;

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open goes back to open
      circuit.state = CircuitState.OPEN;
      circuit.successCount = 0;
      circuit.lastStateChange = now;
      this.logger.warn(
        `[CIRCUIT] ${domain}: HALF_OPEN -> OPEN (recovery failed)`,
      );
    } else if (
      circuit.state === CircuitState.CLOSED &&
      circuit.failureCount >= this.circuitConfig.failureThreshold
    ) {
      // Threshold reached - open the circuit
      circuit.state = CircuitState.OPEN;
      circuit.lastStateChange = now;
      this.logger.warn(
        `[CIRCUIT] ${domain}: CLOSED -> OPEN (threshold reached: ${circuit.failureCount} failures)`,
      );
    }
  }

  /**
   * Get circuit breaker status for monitoring/debugging
   */
  getCircuitStatus(domain: string): CircuitBreakerState | undefined {
    return this.circuits.get(domain);
  }

  /**
   * Get all circuit breaker statuses for monitoring
   */
  getAllCircuitStatuses(): Map<string, CircuitBreakerState> {
    return new Map(this.circuits);
  }

  /**
   * Manually reset a circuit (useful for testing or manual intervention)
   */
  resetCircuit(domain: string): void {
    const circuit = this.circuits.get(domain);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failureCount = 0;
      circuit.successCount = 0;
      circuit.lastStateChange = Date.now();
      this.logger.log(`[CIRCUIT] ${domain}: manually reset to CLOSED`);
    }
  }
}
