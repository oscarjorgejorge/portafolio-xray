import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { getRequestId } from '../context';

/**
 * Log levels for formatting
 */
type LogLevel = 'LOG' | 'ERROR' | 'WARN' | 'DEBUG' | 'VERBOSE';

/**
 * Context-aware logger service that automatically includes request ID in all log messages.
 *
 * Features:
 * - Transient scope: each injection gets a new instance
 * - Automatic request ID inclusion from AsyncLocalStorage
 * - Configurable context (class name)
 * - Consistent log format across the application
 *
 * Log format: timestamp [LEVEL] [requestId] [Context] message
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly logger: ContextLoggerService) {
 *     this.logger.setContext(MyService.name);
 *   }
 *
 *   doSomething() {
 *     this.logger.log('Processing request');
 *     // Output: 2026-01-27T10:30:00.000Z LOG     [abc-123] [MyService] Processing request
 *   }
 * }
 * ```
 */
@Injectable({ scope: Scope.TRANSIENT })
export class ContextLoggerService implements LoggerService {
  private context?: string;

  /**
   * Set the context (typically the class name) for log messages
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Log a message at INFO level
   */
  log(message: string, ...optionalParams: unknown[]): void {
    this.printMessage('LOG', message, optionalParams);
  }

  /**
   * Log a message at ERROR level
   */
  error(message: string, ...optionalParams: unknown[]): void {
    this.printMessage('ERROR', message, optionalParams);
  }

  /**
   * Log a message at WARN level
   */
  warn(message: string, ...optionalParams: unknown[]): void {
    this.printMessage('WARN', message, optionalParams);
  }

  /**
   * Log a message at DEBUG level
   */
  debug(message: string, ...optionalParams: unknown[]): void {
    this.printMessage('DEBUG', message, optionalParams);
  }

  /**
   * Log a message at VERBOSE level
   */
  verbose(message: string, ...optionalParams: unknown[]): void {
    this.printMessage('VERBOSE', message, optionalParams);
  }

  /**
   * Internal method to format and print log messages
   */
  private printMessage(
    level: LogLevel,
    message: string,
    optionalParams: unknown[],
  ): void {
    const requestId = getRequestId();
    const timestamp = new Date().toISOString();
    const contextStr = this.context ? `[${this.context}]` : '';
    const requestIdStr = requestId ? `[${requestId}]` : '[-]';

    // Format: timestamp [LEVEL] [requestId] [context] message
    const formattedMessage = `${timestamp} ${level.padEnd(7)} ${requestIdStr} ${contextStr} ${message}`;

    // Extract stack trace from optional params if present (for errors)
    const stack =
      optionalParams.length > 0 && typeof optionalParams[0] === 'string'
        ? optionalParams[0]
        : undefined;

    switch (level) {
      case 'ERROR':
        if (stack) {
          console.error(formattedMessage, '\n', stack);
        } else {
          console.error(formattedMessage);
        }
        break;
      case 'WARN':
        console.warn(formattedMessage);
        break;
      case 'DEBUG':
      case 'VERBOSE':
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }
}
