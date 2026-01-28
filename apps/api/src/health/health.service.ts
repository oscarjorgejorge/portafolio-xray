import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsinEnrichmentService } from '../assets/isin-enrichment.service';
import {
  HealthResponseDto,
  HealthStatus,
  ComponentStatus,
  EnrichmentStatusDto,
  CircuitBreakerStatusDto,
  CircuitBreakerStatus,
} from './dto/health-response.dto';
import { IHealthService } from './interfaces';
import { LivenessResponse } from './types';
import { createContextLogger } from '../common/logger';
import { HttpClientService, CircuitState } from '../common/http';

// Get version from package.json at build time
const APP_VERSION = process.env.npm_package_version || '1.0.0';

@Injectable()
export class HealthService implements IHealthService {
  private readonly logger = createContextLogger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpClient: HttpClientService,
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

    // Get enrichment queue status if available
    const enrichment = this.getEnrichmentStatus();

    // Get circuit breaker status for external services
    const circuitBreaker = this.getCircuitBreakerStatus();

    // Determine overall status (include circuit breaker in health assessment)
    const status = this.determineOverallStatus(databaseStatus, circuitBreaker);

    return {
      status,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      database: databaseStatus,
      databaseResponseTimeMs,
      ...(enrichment && { enrichment }),
      ...(circuitBreaker && { circuitBreaker }),
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
   * Get circuit breaker status for all tracked external services
   * Returns undefined if no circuits are being tracked
   */
  private getCircuitBreakerStatus(): CircuitBreakerStatusDto | undefined {
    const statuses = this.httpClient.getAllCircuitStatuses();

    if (statuses.size === 0) {
      return undefined;
    }

    const domains: Record<string, CircuitBreakerStatus> = {};
    let openCircuits = 0;

    statuses.forEach((state, domain) => {
      // Map internal CircuitState to DTO enum
      domains[domain] = this.mapCircuitState(state.state);

      if (state.state === CircuitState.OPEN) {
        openCircuits++;
      }
    });

    return {
      domains,
      openCircuits,
      totalCircuits: statuses.size,
    };
  }

  /**
   * Map internal CircuitState to DTO CircuitBreakerStatus
   */
  private mapCircuitState(state: CircuitState): CircuitBreakerStatus {
    switch (state) {
      case CircuitState.CLOSED:
        return CircuitBreakerStatus.CLOSED;
      case CircuitState.OPEN:
        return CircuitBreakerStatus.OPEN;
      case CircuitState.HALF_OPEN:
        return CircuitBreakerStatus.HALF_OPEN;
      default:
        return CircuitBreakerStatus.CLOSED;
    }
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
   * - Database down = DEGRADED (critical component)
   * - Circuit breakers open = DEGRADED (external dependencies failing)
   * - All OK = OK
   */
  private determineOverallStatus(
    databaseStatus: ComponentStatus,
    circuitBreaker?: CircuitBreakerStatusDto,
  ): HealthStatus {
    // Database is critical - if it's down, the service is degraded
    if (databaseStatus !== ComponentStatus.CONNECTED) {
      return HealthStatus.DEGRADED;
    }

    // If any circuit breaker is open, service is degraded
    // (external dependencies are failing)
    if (circuitBreaker && circuitBreaker.openCircuits > 0) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.OK;
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
