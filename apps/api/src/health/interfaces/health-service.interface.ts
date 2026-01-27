import { HealthResponseDto } from '../dto/health-response.dto';

/**
 * Liveness response structure
 */
export interface LivenessResponse {
  status: string;
  timestamp: string;
}

/**
 * Health Service Interface
 * Defines the contract for health check operations
 */
export interface IHealthService {
  /**
   * Perform comprehensive health check
   * Verifies database connectivity and measures response time
   */
  check(): Promise<HealthResponseDto>;

  /**
   * Lightweight liveness check
   * Just confirms the service is running, does not check external dependencies
   */
  liveness(): LivenessResponse;
}

/**
 * Injection token for IHealthService
 */
export const HEALTH_SERVICE = Symbol('HEALTH_SERVICE');
