import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto/health-response.dto';
import { LivenessResponse } from './interfaces';

@ApiTags('health')
@Controller('health')
@SkipThrottle() // Health checks should never be rate limited
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Readiness probe - comprehensive health check
   * Verifies all dependencies (database, etc.) are healthy
   * Use this for Kubernetes readiness probes or load balancer health checks
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness health check',
    description:
      'Comprehensive health check that verifies database connectivity and returns detailed status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    type: HealthResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Service is degraded (some components unhealthy)',
  })
  async check(): Promise<HealthResponseDto> {
    const health = await this.healthService.check();

    // Note: We return 200 even for degraded status
    // This is intentional - the response body indicates the actual status
    // Load balancers can be configured to check the response body if needed
    return health;
  }

  /**
   * Liveness probe - simple ping check
   * Just confirms the service process is running
   * Use this for Kubernetes liveness probes
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Simple liveness check that confirms the service is running. Does not check external dependencies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2025-01-26T10:30:00.000Z' },
      },
    },
  })
  liveness(): LivenessResponse {
    return this.healthService.liveness();
  }

  /**
   * Readiness probe alias for Kubernetes conventions
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness probe (alias)',
    description:
      'Alias for /health endpoint. Returns comprehensive health status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service readiness status',
    type: HealthResponseDto,
  })
  async readiness(): Promise<HealthResponseDto> {
    return this.check();
  }
}
