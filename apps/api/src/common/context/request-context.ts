import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request context data stored throughout the request lifecycle
 */
export interface RequestContext {
  /** Unique identifier for the request */
  requestId: string;
  /** Request start timestamp (ms) */
  startTime: number;
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
}

/**
 * AsyncLocalStorage instance for request context
 * Provides automatic context propagation through async operations
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request ID from context
 * @returns Request ID or undefined if not in a request context
 */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

/**
 * Get the full request context
 * @returns Request context or undefined if not in a request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Header name used for request ID propagation
 */
export const REQUEST_ID_HEADER = 'x-request-id';
