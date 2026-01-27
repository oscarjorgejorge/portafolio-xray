import { Global, Module } from '@nestjs/common';
import { ContextLoggerService } from './context-logger.service';

/**
 * Global Logger Module
 *
 * Provides ContextLoggerService to all modules without explicit imports.
 * The logger automatically includes request ID in all log messages.
 */
@Global()
@Module({
  providers: [ContextLoggerService],
  exports: [ContextLoggerService],
})
export class LoggerModule {}
