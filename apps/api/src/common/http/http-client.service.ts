import { Injectable, Logger } from '@nestjs/common';
import {
  HttpRequestOptions,
  HttpResponse,
  HttpClientConfig,
  ResponseType,
  HttpErrorType,
  HttpError,
} from './http-client.types';
import { IHttpClient } from '../interfaces';

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
 *
 * Error handling:
 * - All errors are captured and included in the response.error field
 * - The response.ok field indicates success (true) or failure (false)
 * - Callers should always check response.ok before using response.data
 * - Error types help categorize failures for appropriate handling
 */
@Injectable()
export class HttpClientService implements IHttpClient {
  private readonly logger = new Logger(HttpClientService.name);
  private readonly config: HttpClientConfig = DEFAULT_CONFIG;

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

        return {
          data,
          status: response.status,
          ok: true,
          headers: response.headers,
        };
      } catch (error) {
        lastError = this.categorizeError(error);

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
}
