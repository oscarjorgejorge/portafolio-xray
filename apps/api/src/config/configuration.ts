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
  morningstarBaseUrl:
    process.env.MORNINGSTAR_BASE_URL || 'https://lt.morningstar.com',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim()),
});

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
  MORNINGSTAR_BASE_URL: 'morningstarBaseUrl',
  CORS_ORIGINS: 'corsOrigins',
} as const satisfies Record<string, keyof AppConfig>;
