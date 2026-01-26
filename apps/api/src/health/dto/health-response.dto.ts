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
    description: 'Error message if any component is unhealthy',
    example: 'Database connection timeout',
  })
  error?: string;
}
