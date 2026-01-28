import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { getRequestId } from '../context';

/**
 * Middleware that logs HTTP requests and responses.
 * Captures method, URL, status code, and response time.
 *
 * Log format: [requestId] METHOD /path STATUS - DURATIONms
 *
 * @example Output:
 * [abc-123] GET /api/assets/resolve 200 - 45ms
 * [def-456] POST /api/xray/generate 201 - 120ms
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const contentLength = res.get('content-length') || '-';
      const requestId = getRequestId();

      // Format: [requestId] METHOD /path STATUS - DURATIONms (SIZE bytes) - IP
      const requestIdStr = requestId ? `[${requestId}] ` : '';
      const message = `${requestIdStr}${method} ${originalUrl} ${statusCode} - ${duration}ms (${contentLength} bytes) - ${ip}`;

      // Log level based on status code
      if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}
