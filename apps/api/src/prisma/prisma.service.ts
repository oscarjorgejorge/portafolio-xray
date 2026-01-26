import 'dotenv/config';
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * PrismaService provides database access through Prisma ORM
 *
 * Note: DATABASE_URL is validated at application startup by ConfigModule.
 * The validation happens before PrismaService is instantiated, ensuring
 * the connection string is always valid when this service is created.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // DATABASE_URL is guaranteed to exist and be valid due to ConfigModule validation
    const connectionString = process.env.DATABASE_URL as string;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
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
    this.logger.log('Database connection closed');
  }
}
