import {
  HttpRequestOptions,
  HttpResponse,
  CircuitBreakerState,
} from '../http/http-client.types';

/**
 * HTTP Client Interface
 * Abstracts HTTP operations for better testability and flexibility
 */
export interface IHttpClient {
  /**
   * Perform a GET request
   * @param url - The URL to request
   * @param options - Optional request configuration
   */
  get<T = unknown>(
    url: string,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;

  /**
   * Perform a POST request
   * @param url - The URL to request
   * @param body - Optional request body
   * @param options - Optional request configuration
   */
  post<T = unknown>(
    url: string,
    body?: unknown,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse<T>>;

  /**
   * Get circuit breaker status for a specific domain
   * @param domain - The domain to check
   */
  getCircuitStatus(domain: string): CircuitBreakerState | undefined;

  /**
   * Get all circuit breaker statuses for monitoring
   */
  getAllCircuitStatuses(): Map<string, CircuitBreakerState>;

  /**
   * Manually reset a circuit breaker for a domain
   * @param domain - The domain to reset
   */
  resetCircuit(domain: string): void;
}

/**
 * Injection token for IHttpClient
 */
export const HTTP_CLIENT = Symbol('HTTP_CLIENT');
