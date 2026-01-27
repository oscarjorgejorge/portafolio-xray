/**
 * Error Reporting Service
 *
 * Centralized error reporting with support for external services.
 * Currently logs to console, but can be extended to integrate with:
 * - Sentry
 * - LogRocket
 * - Datadog
 * - Custom error tracking APIs
 *
 * @example
 * // Future Sentry integration:
 * // import * as Sentry from '@sentry/nextjs';
 * // errorReportingService.setReporter({
 * //   captureException: (error, context) => Sentry.captureException(error, { extra: context }),
 * //   captureMessage: (message, context) => Sentry.captureMessage(message, { extra: context }),
 * // });
 */

export interface ErrorContext {
  /** Component or module where error occurred */
  componentStack?: string;
  /** Additional metadata */
  tags?: Record<string, string>;
  /** User context if available */
  user?: {
    id?: string;
    email?: string;
  };
  /** Extra data to include */
  extra?: Record<string, unknown>;
}

export interface ErrorReporter {
  /** Report an error/exception */
  captureException: (error: Error, context?: ErrorContext) => void;
  /** Report a message (for non-error events) */
  captureMessage: (message: string, context?: ErrorContext) => void;
  /** Set user context for subsequent reports */
  setUser?: (user: ErrorContext['user']) => void;
}

/**
 * Default console reporter for development
 */
const consoleReporter: ErrorReporter = {
  captureException: (error: Error, context?: ErrorContext) => {
    console.error('[Error Report]', error.message, {
      error,
      stack: error.stack,
      ...context,
    });
  },
  captureMessage: (message: string, context?: ErrorContext) => {
    console.warn('[Message Report]', message, context);
  },
};

/**
 * Error Reporting Service singleton
 */
class ErrorReportingService {
  private reporter: ErrorReporter = consoleReporter;
  private isEnabled: boolean = true;

  /**
   * Set a custom error reporter (e.g., Sentry)
   */
  setReporter(reporter: ErrorReporter): void {
    this.reporter = reporter;
  }

  /**
   * Enable or disable error reporting
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Report an error/exception
   */
  captureException(error: Error, context?: ErrorContext): void {
    if (!this.isEnabled) return;

    try {
      this.reporter.captureException(error, context);
    } catch (reporterError) {
      // Fallback to console if reporter fails
      console.error('[ErrorReporting] Failed to report error:', reporterError);
      console.error('[Original Error]', error);
    }
  }

  /**
   * Report a message
   */
  captureMessage(message: string, context?: ErrorContext): void {
    if (!this.isEnabled) return;

    try {
      this.reporter.captureMessage(message, context);
    } catch (reporterError) {
      console.error('[ErrorReporting] Failed to report message:', reporterError);
      console.warn('[Original Message]', message);
    }
  }

  /**
   * Set user context for subsequent reports
   */
  setUser(user: ErrorContext['user']): void {
    if (this.reporter.setUser) {
      this.reporter.setUser(user);
    }
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    this.setUser(undefined);
  }
}

// Export singleton instance
export const errorReportingService = new ErrorReportingService();

// Export convenience functions
export const captureException = (error: Error, context?: ErrorContext) =>
  errorReportingService.captureException(error, context);

export const captureMessage = (message: string, context?: ErrorContext) =>
  errorReportingService.captureMessage(message, context);
