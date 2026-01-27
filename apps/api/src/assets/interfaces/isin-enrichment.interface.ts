/**
 * ISIN Enrichment Service Interface
 * Defines the contract for asynchronous ISIN enrichment operations
 */
export interface IIsinEnrichmentService {
  /**
   * Enrich ISIN in background (fire-and-forget)
   * Does not block - returns immediately
   * @param assetId - The asset's internal UUID
   * @param fundName - The fund name to search for
   */
  enrichIsinInBackground(assetId: string, fundName: string): void;
}

/**
 * Injection token for IIsinEnrichmentService
 */
export const ISIN_ENRICHMENT_SERVICE = Symbol('ISIN_ENRICHMENT_SERVICE');
