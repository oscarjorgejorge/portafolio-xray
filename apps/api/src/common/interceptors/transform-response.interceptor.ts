import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getRequestId } from '../context';

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  requestId?: string;
}

/**
 * Interceptor that wraps all successful responses in a standard format.
 *
 * Response format:
 * ```json
 * {
 *   "success": true,
 *   "data": { ... },
 *   "timestamp": "2026-01-27T10:30:00.000Z",
 *   "requestId": "abc-123"
 * }
 * ```
 *
 * Note: Error responses are handled by AllExceptionsFilter and already
 * have their own consistent format with success: false.
 */
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const requestId = getRequestId();

        return {
          success: true as const,
          data,
          timestamp: new Date().toISOString(),
          ...(requestId && { requestId }),
        };
      }),
    );
  }
}
