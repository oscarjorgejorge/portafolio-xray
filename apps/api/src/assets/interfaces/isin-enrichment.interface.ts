/**
 * ISIN Enrichment Service Interface
 * Defines the contract for asynchronous ISIN enrichment operations
 */
export interface IIsinEnrichmentService {
  /**
   * Enrich ISIN in background (fire-and-forget)
   * Does not block - returns immediately
   * Prevents duplicate enrichments for the same asset
   * @param assetId - The asset's internal UUID
   * @param fundName - The fund name to search for
   */
  enrichIsinInBackground(assetId: string, fundName: string): void;

  /**
   * Check if an enrichment is currently in progress for a given asset
   * Useful for debugging and testing
   * @param assetId - The asset's internal UUID
   * @returns true if enrichment is in progress
   */
  isEnrichmentInProgress(assetId: string): boolean;

  /**
   * Get the number of enrichments currently in progress
   * Useful for monitoring and debugging
   * @returns Number of active enrichment operations
   */
  getActiveEnrichmentCount(): number;
}

/**
 * Injection token for IIsinEnrichmentService
 */
export const ISIN_ENRICHMENT_SERVICE = Symbol('ISIN_ENRICHMENT_SERVICE');
