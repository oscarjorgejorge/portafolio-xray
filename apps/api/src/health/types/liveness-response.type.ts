/**
 * Response structure for liveness health check
 */
export interface LivenessResponse {
  /** Status indicator (always 'ok' for liveness) */
  status: string;

  /** ISO timestamp of the health check */
  timestamp: string;
}
