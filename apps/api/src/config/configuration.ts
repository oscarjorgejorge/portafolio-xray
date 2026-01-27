import type { EnvConfig } from './env.schema';

/**
 * Application configuration factory
 * Maps validated environment variables to a structured configuration object
 */
export const configuration = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV as EnvConfig['NODE_ENV'],
  port: parseInt(process.env.PORT || process.env.API_PORT || '4000', 10),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  databaseUrl: process.env.DATABASE_URL as string,
  dbPool: {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMs: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMs: parseInt(
      process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '5000',
      10,
    ),
  },
  cache: {
    ttlMs: parseInt(process.env.CACHE_TTL_MS || '300000', 10), // 5 minutes
    maxItems: parseInt(process.env.CACHE_MAX_ITEMS || '1000', 10),
  },
  resolution: {
    batchConcurrencyLimit: parseInt(
      process.env.BATCH_CONCURRENCY_LIMIT || '5',
      10,
    ),
    maxAlternatives: parseInt(process.env.MAX_ALTERNATIVES || '5', 10),
    isinEnrichmentConcurrency: parseInt(
      process.env.ISIN_ENRICHMENT_CONCURRENCY || '5',
      10,
    ),
    isinEnrichmentTimeoutMs: parseInt(
      process.env.ISIN_ENRICHMENT_TIMEOUT_MS || '15000',
      10,
    ),
  },
  morningstarBaseUrl:
    process.env.MORNINGSTAR_BASE_URL || 'https://lt.morningstar.com',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim()),
});

/**
 * Database connection pool configuration
 */
export interface DbPoolConfig {
  max: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
}

/**
 * In-memory cache configuration
 */
export interface CacheConfig {
  ttlMs: number;
  maxItems: number;
}

/**
 * Resolution and enrichment configuration
 */
export interface ResolutionConfig {
  /** Max concurrent requests when batch resolving assets */
  batchConcurrencyLimit: number;
  /** Max number of alternatives to return when manual review is needed */
  maxAlternatives: number;
  /** Max concurrent ISIN enrichment operations */
  isinEnrichmentConcurrency: number;
  /** Timeout for ISIN enrichment HTTP requests (ms) */
  isinEnrichmentTimeoutMs: number;
}

/**
 * Type-safe application configuration interface
 * Flat structure for easier ConfigService access
 */
export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  databaseUrl: string;
  dbPool: DbPoolConfig;
  cache: CacheConfig;
  resolution: ResolutionConfig;
  morningstarBaseUrl: string;
  corsOrigins: string[];
}

/**
 * Configuration keys for type-safe access with ConfigService
 */
export const CONFIG_KEYS = {
  NODE_ENV: 'nodeEnv',
  PORT: 'port',
  IS_PRODUCTION: 'isProduction',
  IS_DEVELOPMENT: 'isDevelopment',
  IS_TEST: 'isTest',
  DATABASE_URL: 'databaseUrl',
  DB_POOL: 'dbPool',
  CACHE: 'cache',
  RESOLUTION: 'resolution',
  MORNINGSTAR_BASE_URL: 'morningstarBaseUrl',
  CORS_ORIGINS: 'corsOrigins',
} as const satisfies Record<string, keyof AppConfig>;
