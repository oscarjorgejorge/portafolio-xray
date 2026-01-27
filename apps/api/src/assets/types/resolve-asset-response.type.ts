import { Asset } from '@prisma/client';

/**
 * Alternative asset suggestion when resolution needs manual review
 */
export interface AssetAlternative {
  morningstarId: string;
  name: string;
  url: string;
  score: number;
}

/**
 * Source of the resolved asset
 * - cache: Found in local database cache
 * - resolved: Successfully resolved from external sources
 * - manual_required: Could not resolve automatically, needs manual input
 */
export type ResolveAssetSource = 'cache' | 'resolved' | 'manual_required';

/**
 * Response structure for asset resolution operations
 */
export interface ResolveAssetResponse {
  /** Whether the resolution was successful */
  success: boolean;

  /** Source of the resolution result */
  source: ResolveAssetSource;

  /** The resolved asset (when successful) */
  asset?: Asset;

  /** Whether ISIN enrichment is pending in the background */
  isinPending?: boolean;

  /** Alternative suggestions when manual review is needed */
  alternatives?: AssetAlternative[];

  /** Error message when resolution fails */
  error?: string;
}
