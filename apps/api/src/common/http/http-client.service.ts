import { Injectable, Logger } from '@nestjs/common';
import {
  HttpRequestOptions,
  HttpResponse,
  HttpClientConfig,
  ResponseType,
} from './http-client.types';

const DEFAULT_CONFIG: HttpClientConfig = {
  defaultTimeout: 10000,
  defaultHeaders: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  },
  enableLogging: true,
};

/**
 * Centralized HTTP client service with timeout, retry, and logging support.
 * Abstracts fetch calls for better testability and consistent error handling.
 */
@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);
  private readonly config: HttpClientConfig;

  constructor(config?: Partial<HttpClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

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
   * Core request method with timeout, retry, and error handling
   */
  private async request<T>(
    url: string,
    method: 'GET' | 'POST',
    options?: HttpRequestOptions,
    body?: unknown,
  ): Promise<HttpResponse<T>> {
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

        const data = await this.parseResponse<T>(response, responseType);

        if (this.config.enableLogging && !response.ok) {
          this.logger.warn(
            `[HTTP] ${method} ${url} returned ${response.status}`,
          );
        }

        return {
          data,
          status: response.status,
          ok: response.ok,
          headers: response.headers,
        };
      } catch (error) {
        if (this.isRetryableError(error) && attempts < maxAttempts) {
          this.logger.warn(
            `[HTTP] ${method} ${url} failed (attempt ${attempts}), retrying in ${retryDelay}ms...`,
          );
          await this.delay(retryDelay);
        } else {
          this.logger.error(
            `[HTTP] ${method} ${url} failed: ${this.getErrorMessage(error)}`,
          );
        }
      }
    }

    return {
      data: null,
      status: 0,
      ok: false,
    };
  }

  /**
   * Parse response based on expected type
   */
  private async parseResponse<T>(
    response: Response,
    responseType: ResponseType,
  ): Promise<T | null> {
    if (!response.ok) {
      return null;
    }

    try {
      switch (responseType) {
        case 'json':
          return (await response.json()) as T;
        case 'text':
        case 'html':
          return (await response.text()) as unknown as T;
        default:
          return (await response.text()) as unknown as T;
      }
    } catch {
      return null;
    }
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
   * Extract error message safely
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
