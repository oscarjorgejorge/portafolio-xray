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

export interface HttpResponse<T> {
  data: T | null;
  status: number;
  ok: boolean;
  headers?: Headers;
}

export interface HttpClientConfig {
  /** Default timeout for all requests */
  defaultTimeout: number;
  /** Default headers for all requests */
  defaultHeaders: Record<string, string>;
  /** Enable request logging */
  enableLogging: boolean;
}
