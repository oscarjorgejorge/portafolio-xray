import { Logger, LoggerService } from '@nestjs/common';
import { getRequestId } from '../context';

/**
 * Context-aware logger that extends NestJS Logger to automatically include
 * request ID in all log messages.
 *
 * Features:
 * - Extends NestJS Logger for familiar API
 * - Automatic request ID inclusion from AsyncLocalStorage
 * - Consistent log format across the application
 * - Can be used as a drop-in replacement for NestJS Logger
 *
 * @example
 * ```typescript
 * // Instead of: private readonly logger = new Logger(MyService.name);
 * // Use:
 * private readonly logger = new ContextLogger(MyService.name);
 *
 * // Or use the factory function:
 * private readonly logger = createContextLogger(MyService.name);
 * ```
 */
export class ContextLogger extends Logger implements LoggerService {
  constructor(context: string) {
    super(context);
  }

  /**
   * Prepend request ID to the message if available
   */
  private formatMessage(message: string): string {
    const requestId = getRequestId();
    if (requestId) {
      return `[${requestId}] ${message}`;
    }
    return message;
  }

  log(message: string, ...optionalParams: unknown[]): void {
    super.log(this.formatMessage(message), ...optionalParams);
  }

  error(message: string, ...optionalParams: unknown[]): void {
    super.error(this.formatMessage(message), ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    super.warn(this.formatMessage(message), ...optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    super.debug(this.formatMessage(message), ...optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    super.verbose(this.formatMessage(message), ...optionalParams);
  }
}

/**
 * Factory function to create a context-aware logger.
 * This is a convenience function for creating ContextLogger instances.
 *
 * @param context - The context name (typically the class name)
 * @returns A new ContextLogger instance
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   private readonly logger = createContextLogger(MyService.name);
 *
 *   doSomething() {
 *     this.logger.log('Processing request');
 *     // Output includes request ID: [INFO] [abc-123] [MyService] Processing request
 *   }
 * }
 * ```
 */
export function createContextLogger(context: string): ContextLogger {
  return new ContextLogger(context);
}

/**
 * @deprecated Use ContextLogger or createContextLogger instead.
 * Kept for backward compatibility with injectable logger pattern.
 */
export class ContextLoggerService extends ContextLogger {
  private _context = 'Application';

  constructor() {
    super('Application');
  }

  setContext(context: string): void {
    this._context = context;
    // Update the internal context - workaround since Logger
    // doesn't expose a public setContext method
    Object.assign(this, { context });
  }
}
