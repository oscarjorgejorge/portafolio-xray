import { API } from '@/lib/constants';
import { env } from '@/lib/env';
import { tokenStorage } from '@/lib/auth/token-storage';

/**
 * Error thrown by API client
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Request configuration options
 */
interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Response wrapper to maintain axios-like API
 */
interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * Standard API response wrapper from the backend
 * All successful responses are wrapped in this format by TransformResponseInterceptor
 */
interface ApiResponseWrapper<T> {
  success: boolean;
  data: T;
  timestamp: string;
  requestId?: string;
}

/**
 * Lightweight fetch-based API client
 * Replaces axios for smaller bundle size (~13KB savings)
 */
class FetchApiClient {
  private baseURL: string;
  private defaultTimeout: number;
  private defaultHeaders: Record<string, string>;

  constructor(config: {
    baseURL: string;
    timeout: number;
    headers: Record<string, string>;
  }) {
    this.baseURL = config.baseURL;
    this.defaultTimeout = config.timeout;
    this.defaultHeaders = config.headers;
  }

  /**
   * Refresh token callback (set by auth module to avoid circular deps)
   */
  private refreshTokenCallback: (() => Promise<void>) | null = null;

  /**
   * Set the refresh token callback
   */
  setRefreshCallback(callback: () => Promise<void>): void {
    this.refreshTokenCallback = callback;
  }

  /**
   * Get auth headers with current access token
   */
  private getAuthHeaders(): Record<string, string> {
    const token = tokenStorage.getAccessToken();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  /**
   * Check if we need to refresh the token before making a request
   */
  private async ensureValidToken(): Promise<void> {
    if (tokenStorage.hasTokens() && tokenStorage.isAccessTokenExpired()) {
      if (this.refreshTokenCallback) {
        await this.refreshTokenCallback();
      }
    }
  }

  /**
   * Get current locale from URL path
   * Extracts locale from pathname (e.g., /es/... or /en/...)
   */
  private getLocaleFromUrl(): string {
    if (typeof window === 'undefined') {
      return 'es'; // Default for SSR
    }
    const pathname = window.location.pathname;
    const localeMatch = pathname.match(/^\/(es|en)\//);
    return localeMatch ? localeMatch[1] : 'es';
  }

  /**
   * Make a fetch request with timeout and error handling
   */
  private async request<T>(
    method: string,
    path: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    // Skip token refresh for auth endpoints to avoid circular calls
    const isAuthEndpoint = path.startsWith('/auth/');
    if (!isAuthEndpoint) {
      await this.ensureValidToken();
    }

    const url = `${this.baseURL}${path}`;
    const timeout = config?.timeout ?? this.defaultTimeout;

    // Get current locale and add Accept-Language header
    const locale = this.getLocaleFromUrl();

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...this.defaultHeaders,
          'Accept-Language': locale,
          ...this.getAuthHeaders(),
          ...config?.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: config?.signal ?? controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response data
      let rawData: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        rawData = await response.json();
      } else {
        rawData = await response.text();
      }

      // Handle error responses
      if (!response.ok) {
        const message =
          (rawData as { message?: string })?.message ||
          `Request failed with status ${response.status}`;
        throw new ApiError(message, response.status, rawData);
      }

      // Unwrap the standard API response envelope { success, data, timestamp, requestId }
      // The backend wraps all successful responses in this format via TransformResponseInterceptor
      let responseData: T;
      if (
        typeof rawData === 'object' &&
        rawData !== null &&
        'success' in rawData &&
        'data' in rawData
      ) {
        const wrapper = rawData as ApiResponseWrapper<T>;
        responseData = wrapper.data;
      } else {
        responseData = rawData as T;
      }

      return {
        data: responseData,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(
          'Request timed out. The server took too long to respond.'
        );
      }

      // Handle network errors
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new ApiError('Network error. Please check your connection.');
      }

      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
      }

      // Wrap other errors
      throw new ApiError(
        error instanceof Error ? error.message : 'An error occurred'
      );
    }
  }

  /**
   * GET request
   */
  async get<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, config);
  }

  /**
   * POST request
   */
  async post<T>(
    path: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, data, config);
  }

  /**
   * PATCH request
   */
  async patch<T>(
    path: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, data, config);
  }

  /**
   * PUT request
   */
  async put<T>(
    path: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, data, config);
  }

  /**
   * DELETE request
   */
  async delete<T>(
    path: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, config);
  }
}

/**
 * Configured API client instance
 */
export const apiClient = new FetchApiClient({
  baseURL: env.NEXT_PUBLIC_API_URL,
  timeout: API.TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

