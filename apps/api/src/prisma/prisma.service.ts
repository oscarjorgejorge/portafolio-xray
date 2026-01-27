import 'dotenv/config';
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { AppConfig } from '../config';

/**
 * Connection retry configuration
 * Uses exponential backoff: delay = baseDelay * 2^(attempt-1)
 */
const CONNECTION_RETRY = {
  /** Maximum number of connection attempts */
  MAX_RETRIES: 3,
  /** Base delay between retries in milliseconds */
  BASE_DELAY_MS: 1000,
  /** Maximum delay between retries in milliseconds */
  MAX_DELAY_MS: 10000,
} as const;

/**
 * PrismaService provides database access through Prisma ORM
 *
 * Note: DATABASE_URL is validated at application startup by ConfigModule.
 * The validation happens before PrismaService is instantiated, ensuring
 * the connection string is always valid when this service is created.
 *
 * Connection pool settings are configurable via environment variables:
 * - DB_POOL_MAX: Maximum number of connections (default: 20)
 * - DB_POOL_IDLE_TIMEOUT_MS: Idle connection timeout (default: 30000ms)
 * - DB_POOL_CONNECTION_TIMEOUT_MS: Connection timeout (default: 5000ms)
 *
 * Features:
 * - Automatic retry with exponential backoff on initial connection failure
 * - Graceful shutdown with proper connection cleanup
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const databaseUrl = configService.get('databaseUrl', { infer: true });
    const poolConfig = configService.get('dbPool', { infer: true });

    // Create connection pool with configurable settings
    const pool = new Pool({
      connectionString: databaseUrl,
      max: poolConfig.max,
      idleTimeoutMillis: poolConfig.idleTimeoutMs,
      connectionTimeoutMillis: poolConfig.connectionTimeoutMs,
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });

    this.pool = pool;
    this.isProduction = configService.get('isProduction', { infer: true });

    // Log pool configuration at startup
    this.logger.log(
      `Database pool configured: max=${poolConfig.max}, idleTimeout=${poolConfig.idleTimeoutMs}ms, connectionTimeout=${poolConfig.connectionTimeoutMs}ms`,
    );
  }

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  /**
   * Attempt database connection with exponential backoff retry
   * In production, fails fast after all retries exhausted
   * In development, allows app to start for resilience during temporary DB issues
   */
  private async connectWithRetry(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= CONNECTION_RETRY.MAX_RETRIES; attempt++) {
      try {
        await this.$connect();
        this.logger.log(
          `Database connected successfully${attempt > 1 ? ` (attempt ${attempt})` : ''}`,
        );
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isLastAttempt = attempt === CONNECTION_RETRY.MAX_RETRIES;

        if (isLastAttempt) {
          this.logger.error(
            `Database connection failed after ${attempt} attempts: ${lastError.message}`,
          );
        } else {
          const delay = this.calculateBackoffDelay(attempt);
          this.logger.warn(
            `Database connection attempt ${attempt}/${CONNECTION_RETRY.MAX_RETRIES} failed: ${lastError.message}. Retrying in ${delay}ms...`,
          );
          await this.delay(delay);
        }
      }
    }

    // All retries exhausted
    if (this.isProduction) {
      // In production, fail fast to let orchestrator restart the service
      this.logger.error(
        'Database connection failed in production - terminating process',
      );
      process.exit(1);
    } else {
      // In development, allow app to start (health check will reflect status)
      this.logger.warn(
        'Database connection failed in development - app starting without DB (health check will reflect status)',
      );
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   * Formula: min(maxDelay, baseDelay * 2^(attempt-1)) + random jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay =
      CONNECTION_RETRY.BASE_DELAY_MS * Math.pow(2, attempt - 1);
    const cappedDelay = Math.min(
      exponentialDelay,
      CONNECTION_RETRY.MAX_DELAY_MS,
    );
    // Add 10% random jitter to prevent thundering herd
    const jitter = cappedDelay * 0.1 * Math.random();
    return Math.floor(cappedDelay + jitter);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Database connection and pool closed');
  }
}
