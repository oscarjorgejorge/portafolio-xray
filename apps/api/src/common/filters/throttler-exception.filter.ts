import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

/**
 * Custom exception filter for rate limiting errors.
 * Provides a user-friendly error message when rate limit is exceeded.
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = HttpStatus.TOO_MANY_REQUESTS;

    response.status(status).json({
      success: false,
      statusCode: status,
      error: 'Too Many Requests',
      message:
        'Rate limit exceeded. Please slow down your requests and try again later.',
      retryAfter: 60, // Suggest retry after 60 seconds
      timestamp: new Date().toISOString(),
    });
  }
}
