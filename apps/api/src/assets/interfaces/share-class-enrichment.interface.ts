/**
 * Share-class enrichment service
 * Resolves Instant X-Ray F IDs in the background without blocking resolve/confirm.
 */
export interface IShareClassEnrichmentService {
  /**
   * Enrich shareClassId in background (fire-and-forget).
   * Deduplicates in-flight work and queues excess requests.
   */
  enrichShareClassInBackground(assetId: string): void;

  /** True if the asset is active or waiting in the queue */
  isEnrichmentInProgress(assetId: string): boolean;

  getActiveEnrichmentCount(): number;
  getPendingEnrichmentCount(): number;
}

export const SHARE_CLASS_ENRICHMENT_SERVICE = Symbol(
  'SHARE_CLASS_ENRICHMENT_SERVICE',
);
