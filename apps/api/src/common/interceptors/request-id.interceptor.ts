import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { requestContext, RequestContext, REQUEST_ID_HEADER } from '../context';

/**
 * Interceptor that generates/propagates request IDs for request correlation.
 *
 * Features:
 * - Generates unique request ID if not provided in headers
 * - Propagates existing request ID from 'x-request-id' header
 * - Adds request ID to response headers for client correlation
 * - Logs request start/end with duration
 * - Stores context in AsyncLocalStorage for access throughout request lifecycle
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    // Use existing request ID from header or generate new one
    const requestId =
      (request.headers[REQUEST_ID_HEADER] as string) || randomUUID();

    // Add request ID to response headers for client correlation
    response.setHeader(REQUEST_ID_HEADER, requestId);

    const ctx: RequestContext = {
      requestId,
      startTime: Date.now(),
      method: request.method,
      path: request.url,
    };

    // Run the handler within the async local storage context
    return new Observable((subscriber) => {
      requestContext.run(ctx, () => {
        this.logger.log(`[${requestId}] --> ${request.method} ${request.url}`);

        next
          .handle()
          .pipe(
            tap({
              next: () => {
                const duration = Date.now() - ctx.startTime;
                this.logger.log(
                  `[${requestId}] <-- ${request.method} ${request.url} ${response.statusCode} ${duration}ms`,
                );
              },
              error: (error: { status?: number }) => {
                const duration = Date.now() - ctx.startTime;
                this.logger.error(
                  `[${requestId}] <-- ${request.method} ${request.url} ${error.status || 500} ${duration}ms`,
                );
              },
            }),
          )
          .subscribe(subscriber);
      });
    });
  }
}
