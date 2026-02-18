import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { getRequestId } from '../context';

/**
 * Response structure for error responses
 */
interface ErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Global exception filter that catches all unhandled exceptions.
 * Provides consistent error response format across the API.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = getRequestId();

    const details = this.getErrorDetails(exception);

    // Log the error with appropriate level (includes requestId)
    this.logError(exception, request, details.status, requestId);

    const errorResponse: Record<string, unknown> = {
      success: false,
      statusCode: details.status,
      error: details.error,
      message: details.message,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    };

    // Preserve custom payload from HttpException (e.g. userEmail, emailVerified for verify-email)
    if (
      details.extra &&
      typeof details.extra === 'object' &&
      details.extra !== null
    ) {
      Object.assign(errorResponse, details.extra);
    }

    response.status(details.status).json(errorResponse);
  }

  /**
   * Extract error details from the exception
   */
  private getErrorDetails(exception: unknown): {
    status: number;
    error: string;
    message: string;
    extra?: Record<string, unknown>;
  } {
    // Handle NestJS HTTP exceptions (400, 401, 403, 404, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle validation errors (class-validator) or custom payload object
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const response = exceptionResponse as Record<string, unknown>;
        const { message, error, ...extra } = response;
        return {
          status,
          error: (error as string) || this.getHttpErrorName(status),
          message: this.extractMessage(response),
          extra: Object.keys(extra).length > 0 ? extra : undefined,
        };
      }

      return {
        status,
        error: this.getHttpErrorName(status),
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : exception.message,
      };
    }

    // Handle unknown/unexpected errors - return 500
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    };
  }

  /**
   * Extract message from exception response (handles validation errors)
   */
  private extractMessage(response: Record<string, unknown>): string {
    // Class-validator returns messages as array
    if (Array.isArray(response.message)) {
      return response.message.join('. ');
    }
    if (typeof response.message === 'string') {
      return response.message;
    }
    return 'An error occurred';
  }

  /**
   * Get human-readable HTTP error name
   */
  private getHttpErrorName(status: number): string {
    const errorNames: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
      [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
    };

    return errorNames[status] || 'Error';
  }

  /**
   * Log error with appropriate level based on status code
   */
  private logError(
    exception: unknown,
    request: Request,
    status: number,
    requestId?: string,
  ): void {
    const errorMessage =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const reqIdStr = requestId ? `[${requestId}]` : '[-]';
    const context = `${reqIdStr} ${request.method} ${request.url}`;

    // 5xx errors are logged as errors (unexpected issues)
    // 4xx errors are logged as warnings (client errors)
    if (status >= 500) {
      this.logger.error(`${context} ${errorMessage}`, stack);
    } else if (status >= 400) {
      this.logger.warn(`${context} ${status} - ${errorMessage}`);
    }
  }
}
