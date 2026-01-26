import { Logger } from '@nestjs/common';

/**
 * Error types for categorization and handling
 */
export enum ErrorCategory {
  /** Network-related errors (timeouts, connection failures) */
  NETWORK = 'NETWORK',
  /** JSON parsing errors */
  PARSE = 'PARSE',
  /** Invalid URL format */
  URL = 'URL',
  /** Unexpected/unknown errors */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Structured error information
 */
export interface ErrorInfo {
  category: ErrorCategory;
  message: string;
  originalError?: unknown;
}

/**
 * Categorize an error for appropriate handling
 */
export function categorizeError(error: unknown): ErrorInfo {
  if (error instanceof SyntaxError) {
    return {
      category: ErrorCategory.PARSE,
      message: 'Invalid JSON format',
      originalError: error,
    };
  }

  if (error instanceof TypeError) {
    // Usually network errors in fetch
    return {
      category: ErrorCategory.NETWORK,
      message: error.message || 'Network error',
      originalError: error,
    };
  }

  if (error instanceof URIError) {
    return {
      category: ErrorCategory.URL,
      message: 'Invalid URL encoding',
      originalError: error,
    };
  }

  if (error instanceof DOMException) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return {
        category: ErrorCategory.NETWORK,
        message: `Request ${error.name.replace('Error', '').toLowerCase()}`,
        originalError: error,
      };
    }
  }

  return {
    category: ErrorCategory.UNKNOWN,
    message: getErrorMessage(error),
    originalError: error,
  };
}

/**
 * Safely extract error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Log error with consistent format based on severity
 * @param logger - NestJS Logger instance
 * @param context - Context string (e.g., strategy name)
 * @param operation - Operation being performed
 * @param error - The error to log
 * @param logLevel - Override the default log level
 */
export function logError(
  logger: Logger,
  context: string,
  operation: string,
  error: unknown,
  logLevel: 'debug' | 'warn' | 'error' = 'warn',
): void {
  const errorInfo = categorizeError(error);

  const message = `[${context}] ${operation} failed: ${errorInfo.message} (${errorInfo.category})`;

  switch (logLevel) {
    case 'debug':
      logger.debug(message);
      break;
    case 'error':
      logger.error(message);
      break;
    case 'warn':
    default:
      logger.warn(message);
      break;
  }
}

/**
 * Safe JSON parse with error handling
 * Returns null on parse failure instead of throwing
 */
export function safeJsonParse<T>(
  json: string,
  logger?: Logger,
  context?: string,
): T | null {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    if (logger && context) {
      logError(logger, context, 'JSON parse', error, 'debug');
    }
    return null;
  }
}

/**
 * Safe URL parsing with fallback
 */
export function safeUrlParse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Execute an operation with standardized error handling
 * Returns a default value on error
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  defaultValue: T,
  logger: Logger,
  context: string,
  operationName: string,
  logLevel: 'debug' | 'warn' | 'error' = 'warn',
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logError(logger, context, operationName, error, logLevel);
    return defaultValue;
  }
}
