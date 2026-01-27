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
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

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

    // Log pool configuration at startup
    this.logger.log(
      `Database pool configured: max=${poolConfig.max}, idleTimeout=${poolConfig.idleTimeoutMs}ms, connectionTimeout=${poolConfig.connectionTimeoutMs}ms`,
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Database connection failed: ${errorMessage}`);

      // In production, we might want to fail fast instead of continuing
      // For now, we allow the app to start for resilience during temporary DB issues
      // The health check should reflect the actual DB connection status
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Database connection and pool closed');
  }
}
