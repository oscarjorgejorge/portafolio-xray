/**
 * ISIN Enrichment Service Interface
 * Defines the contract for asynchronous ISIN enrichment operations
 */
export interface IIsinEnrichmentService {
  /**
   * Enrich ISIN in background (fire-and-forget)
   * Does not block - returns immediately
   * Respects concurrency limit and queues excess requests
   * Prevents duplicate enrichments for the same asset
   * @param assetId - The asset's internal UUID
   * @param fundName - The fund name to search for
   */
  enrichIsinInBackground(assetId: string, fundName: string): void;

  /**
   * Check if an enrichment is currently tracked (active or pending)
   * Useful for debugging and testing
   * @param assetId - The asset's internal UUID
   * @returns true if enrichment is tracked
   */
  isEnrichmentInProgress(assetId: string): boolean;

  /**
   * Check if an enrichment is currently active (not just pending)
   * @param assetId - The asset's internal UUID
   * @returns true if enrichment is actively running
   */
  isEnrichmentActive(assetId: string): boolean;

  /**
   * Get the number of enrichments currently active
   * Useful for monitoring and debugging
   * @returns Number of active enrichment operations
   */
  getActiveEnrichmentCount(): number;

  /**
   * Get the number of enrichments waiting in the queue
   * @returns Number of pending enrichment operations
   */
  getPendingEnrichmentCount(): number;

  /**
   * Get total tracked enrichments (active + pending)
   * @returns Total number of tracked enrichments
   */
  getTotalTrackedCount(): number;

  /**
   * Get the maximum concurrent enrichments limit
   * @returns Maximum number of concurrent operations allowed
   */
  getMaxConcurrentLimit(): number;
}

/**
 * Injection token for IIsinEnrichmentService
 */
export const ISIN_ENRICHMENT_SERVICE = Symbol('ISIN_ENRICHMENT_SERVICE');
