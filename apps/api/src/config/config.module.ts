import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configuration } from './configuration';
import { validateEnv } from './env.schema';

/**
 * Global configuration module
 * Loads and validates environment variables at application startup
 *
 * Features:
 * - Schema validation with Zod (fails fast on missing/invalid env vars)
 * - Type-safe configuration access via ConfigService
 * - Global module (no need to import in other modules)
 * - Expandable variables support (e.g., $VAR or ${VAR})
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true, // Cache config for performance
      expandVariables: true, // Support ${VAR} syntax
      validate: validateEnv,
      load: [configuration],
    }),
  ],
})
export class ConfigModule {}
