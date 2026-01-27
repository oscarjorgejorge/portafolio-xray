import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

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

    const { status, error, message } = this.getErrorDetails(exception);

    // Log the error with appropriate level
    this.logError(exception, request, status);

    const errorResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Extract error details from the exception
   */
  private getErrorDetails(exception: unknown): {
    status: number;
    error: string;
    message: string;
  } {
    // Handle NestJS HTTP exceptions (400, 401, 403, 404, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle validation errors (class-validator)
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const response = exceptionResponse as Record<string, unknown>;
        return {
          status,
          error: (response.error as string) || this.getHttpErrorName(status),
          message: this.extractMessage(response),
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
  private logError(exception: unknown, request: Request, status: number): void {
    const errorMessage =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const context = `${request.method} ${request.url}`;

    // 5xx errors are logged as errors (unexpected issues)
    // 4xx errors are logged as warnings (client errors)
    if (status >= 500) {
      this.logger.error(`[${context}] ${errorMessage}`, stack);
    } else if (status >= 400) {
      this.logger.warn(`[${context}] ${status} - ${errorMessage}`);
    }
  }
}
