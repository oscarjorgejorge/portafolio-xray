import { ResolveAssetResponse } from './resolve-asset-response.type';

/**
 * Individual result within a batch resolution response
 */
export interface BatchResolveResultItem {
  /** Original input that was resolved */
  input: string;
  /** Resolution result for this input */
  result: ResolveAssetResponse;
}

/**
 * Response structure for batch asset resolution
 */
export interface BatchResolveAssetResponse {
  /** Total number of assets requested */
  total: number;
  /** Number of assets successfully resolved (from cache or external) */
  resolved: number;
  /** Number of assets that need manual intervention */
  manualRequired: number;
  /** Individual results for each input */
  results: BatchResolveResultItem[];
}
