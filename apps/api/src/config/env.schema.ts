import { z } from 'zod';

/**
 * Environment variables schema with validation
 * All required variables must be present, optional ones have defaults
 */
export const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(4000),
  API_PORT: z.coerce.number().min(1).max(65535).optional(),

  // Database
  DATABASE_URL: z
    .string()
    .url({ message: 'DATABASE_URL must be a valid PostgreSQL connection URL' }),

  // Database Connection Pool
  DB_POOL_MAX: z.coerce.number().min(1).max(100).default(20),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().min(0).default(30000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().min(0).default(5000),

  // External Services
  MORNINGSTAR_BASE_URL: z.string().url().default('https://lt.morningstar.com'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // In-Memory Cache
  CACHE_TTL_MS: z.coerce.number().min(0).default(300000), // 5 minutes default
  CACHE_MAX_ITEMS: z.coerce.number().min(1).default(1000),
});

/**
 * Type-safe environment configuration
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 * Throws descriptive error if validation fails
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Environment validation failed:\n${errors}\n\nPlease check your .env file or environment variables.`,
    );
  }

  return result.data;
}
