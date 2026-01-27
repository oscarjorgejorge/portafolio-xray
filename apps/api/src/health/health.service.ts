import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsinEnrichmentService } from '../assets/isin-enrichment.service';
import {
  HealthResponseDto,
  HealthStatus,
  ComponentStatus,
  EnrichmentStatusDto,
} from './dto/health-response.dto';
import { IHealthService } from './interfaces';
import { LivenessResponse } from './types';

// Get version from package.json at build time
const APP_VERSION = process.env.npm_package_version || '1.0.0';

@Injectable()
export class HealthService implements IHealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly isinEnrichment?: IsinEnrichmentService,
  ) {}

  /**
   * Perform comprehensive health check
   * Verifies database connectivity and measures response time
   */
  async check(): Promise<HealthResponseDto> {
    const startTime = Date.now();
    let databaseStatus = ComponentStatus.DISCONNECTED;
    let databaseResponseTimeMs: number | undefined;
    let error: string | undefined;

    try {
      // Execute a simple query to verify database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = ComponentStatus.CONNECTED;
      databaseResponseTimeMs = Date.now() - startTime;

      this.logger.debug(
        `Database health check passed in ${databaseResponseTimeMs}ms`,
      );
    } catch (err) {
      databaseResponseTimeMs = Date.now() - startTime;
      error = this.getErrorMessage(err);
      this.logger.warn(`Database health check failed: ${error}`);
    }

    // Determine overall status
    const status = this.determineOverallStatus(databaseStatus);

    // Get enrichment queue status if available
    const enrichment = this.getEnrichmentStatus();

    return {
      status,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      database: databaseStatus,
      databaseResponseTimeMs,
      ...(enrichment && { enrichment }),
      ...(error && { error }),
    };
  }

  /**
   * Get ISIN enrichment queue status
   */
  private getEnrichmentStatus(): EnrichmentStatusDto | undefined {
    if (!this.isinEnrichment) {
      return undefined;
    }

    return {
      active: this.isinEnrichment.getActiveEnrichmentCount(),
      pending: this.isinEnrichment.getPendingEnrichmentCount(),
      maxConcurrent: this.isinEnrichment.getMaxConcurrentLimit(),
    };
  }

  /**
   * Lightweight liveness check - just confirms the service is running
   * Does not check external dependencies
   */
  liveness(): LivenessResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Determine overall health status based on component statuses
   */
  private determineOverallStatus(
    databaseStatus: ComponentStatus,
  ): HealthStatus {
    if (databaseStatus === ComponentStatus.CONNECTED) {
      return HealthStatus.OK;
    }
    // Database is critical - if it's down, the service is degraded
    return HealthStatus.DEGRADED;
  }

  /**
   * Safely extract error message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
