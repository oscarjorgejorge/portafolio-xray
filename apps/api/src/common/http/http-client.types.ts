/**
 * HTTP Client Types
 */

export type ResponseType = 'json' | 'text' | 'html';

export interface HttpRequestOptions {
  /** Custom headers to merge with defaults */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Expected response type (default: 'json') */
  responseType?: ResponseType;
  /** Number of retry attempts (default: 0) */
  retries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
}

/**
 * HTTP Error types for categorizing failures
 */
export enum HttpErrorType {
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  ABORT = 'ABORT',
  PARSE = 'PARSE',
  HTTP_ERROR = 'HTTP_ERROR',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  UNKNOWN = 'UNKNOWN',
}

/**
 * HTTP Error details for debugging
 */
export interface HttpError {
  type: HttpErrorType;
  message: string;
  /** Original error if available */
  cause?: Error;
}

export interface HttpResponse<T> {
  data: T | null;
  status: number;
  ok: boolean;
  headers?: Headers;
  /** Error details when ok=false */
  error?: HttpError;
}

export interface HttpClientConfig {
  /** Default timeout for all requests */
  defaultTimeout: number;
  /** Default headers for all requests */
  defaultHeaders: Record<string, string>;
  /** Enable request logging */
  enableLogging: boolean;
}

/**
 * Circuit Breaker states
 */
export enum CircuitState {
  /** Normal operation - requests pass through */
  CLOSED = 'CLOSED',
  /** Circuit is tripped - requests fail immediately */
  OPEN = 'OPEN',
  /** Testing if service recovered - allows limited requests */
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit Breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number;
  /** Time in ms to wait before trying half-open (default: 30000) */
  resetTimeoutMs: number;
  /** Number of successful requests in half-open to close circuit (default: 2) */
  successThreshold: number;
}

/**
 * Circuit Breaker state per domain
 */
export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastStateChange: number;
}
