import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum HealthStatus {
  OK = 'ok',
  DEGRADED = 'degraded',
  DOWN = 'down',
}

export enum ComponentStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
}

/**
 * Circuit breaker state for a specific domain
 */
export enum CircuitBreakerStatus {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker status for external services
 */
export class CircuitBreakerStatusDto {
  @ApiProperty({
    description: 'Circuit breaker states per domain',
    example: {
      'lt.morningstar.com': 'CLOSED',
      'html.duckduckgo.com': 'CLOSED',
    },
    type: 'object',
    additionalProperties: {
      type: 'string',
      enum: ['CLOSED', 'OPEN', 'HALF_OPEN'],
    },
  })
  domains: Record<string, CircuitBreakerStatus>;

  @ApiProperty({
    description: 'Number of circuits currently open (failing)',
    example: 0,
  })
  openCircuits: number;

  @ApiProperty({
    description: 'Total number of tracked circuits',
    example: 2,
  })
  totalCircuits: number;
}

/**
 * Background enrichment queue status
 */
export class EnrichmentStatusDto {
  @ApiProperty({
    description: 'Number of enrichment tasks currently running',
    example: 2,
  })
  active: number;

  @ApiProperty({
    description: 'Number of enrichment tasks waiting in queue',
    example: 5,
  })
  pending: number;

  @ApiProperty({
    description: 'Maximum concurrent enrichment limit',
    example: 5,
  })
  maxConcurrent: number;
}

export class HealthResponseDto {
  @ApiProperty({
    description: 'Overall health status',
    enum: HealthStatus,
    example: HealthStatus.OK,
  })
  status: HealthStatus;

  @ApiProperty({
    description: 'ISO timestamp of health check',
    example: '2025-01-26T10:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Application version',
    example: '1.0.0',
  })
  version: string;

  @ApiProperty({
    description: 'Database connection status',
    enum: ComponentStatus,
    example: ComponentStatus.CONNECTED,
  })
  database: ComponentStatus;

  @ApiPropertyOptional({
    description: 'Database response time in milliseconds',
    example: 5,
  })
  databaseResponseTimeMs?: number;

  @ApiPropertyOptional({
    description: 'ISIN enrichment background queue status',
    type: EnrichmentStatusDto,
  })
  enrichment?: EnrichmentStatusDto;

  @ApiPropertyOptional({
    description: 'Circuit breaker status for external HTTP services',
    type: CircuitBreakerStatusDto,
  })
  circuitBreaker?: CircuitBreakerStatusDto;

  @ApiPropertyOptional({
    description: 'Error message if any component is unhealthy',
    example: 'Database connection timeout',
  })
  error?: string;
}
