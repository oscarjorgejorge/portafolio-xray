import { Logger, LoggerService } from '@nestjs/common';
import { getRequestId } from '../context';

/**
 * Check if running in production mode
 */
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Log level mapping for JSON output
 */
type LogLevelName = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

/**
 * Structured log entry for JSON format
 */
interface JsonLogEntry {
  timestamp: string;
  level: LogLevelName;
  context: string;
  message: string;
  requestId?: string;
  stack?: string;
  data?: unknown;
}

/**
 * Context-aware logger that extends NestJS Logger to automatically include
 * request ID in all log messages.
 *
 * Features:
 * - Extends NestJS Logger for familiar API
 * - Automatic request ID inclusion from AsyncLocalStorage
 * - JSON structured output in production for log aggregation tools
 * - Human-readable format in development for easier debugging
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
  private readonly contextName: string;

  constructor(context: string) {
    super(context);
    this.contextName = context;
  }

  /**
   * Format message for development (human-readable)
   */
  private formatMessageDev(message: string): string {
    const requestId = getRequestId();
    if (requestId) {
      return `[${requestId}] ${message}`;
    }
    return message;
  }

  /**
   * Output JSON structured log for production
   */
  private logJson(
    level: LogLevelName,
    message: string,
    stack?: string,
    data?: unknown,
  ): void {
    const entry: JsonLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.contextName,
      message,
    };

    const requestId = getRequestId();
    if (requestId) {
      entry.requestId = requestId;
    }

    if (stack) {
      entry.stack = stack;
    }

    if (data !== undefined) {
      entry.data = data;
    }

    // Output JSON to stdout/stderr based on level
    const output = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  log(message: string, ...optionalParams: unknown[]): void {
    if (isProduction) {
      this.logJson(
        'log',
        message,
        undefined,
        optionalParams.length > 0 ? optionalParams : undefined,
      );
    } else {
      super.log(this.formatMessageDev(message), ...optionalParams);
    }
  }

  error(message: string, ...optionalParams: unknown[]): void {
    if (isProduction) {
      // Extract stack trace if present (typically second parameter)
      const stack =
        typeof optionalParams[0] === 'string' ? optionalParams[0] : undefined;
      const data =
        optionalParams.length > 1 || typeof optionalParams[0] !== 'string'
          ? optionalParams
          : undefined;
      this.logJson('error', message, stack, data);
    } else {
      super.error(this.formatMessageDev(message), ...optionalParams);
    }
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    if (isProduction) {
      this.logJson(
        'warn',
        message,
        undefined,
        optionalParams.length > 0 ? optionalParams : undefined,
      );
    } else {
      super.warn(this.formatMessageDev(message), ...optionalParams);
    }
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    if (isProduction) {
      this.logJson(
        'debug',
        message,
        undefined,
        optionalParams.length > 0 ? optionalParams : undefined,
      );
    } else {
      super.debug(this.formatMessageDev(message), ...optionalParams);
    }
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    if (isProduction) {
      this.logJson(
        'verbose',
        message,
        undefined,
        optionalParams.length > 0 ? optionalParams : undefined,
      );
    } else {
      super.verbose(this.formatMessageDev(message), ...optionalParams);
    }
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
