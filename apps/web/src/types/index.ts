// Re-export API types for centralized access
export type { Asset, AssetType, AlternativeAsset } from '@/lib/api/assets';

/**
 * Portfolio asset status
 */
export type PortfolioAssetStatus =
  | 'pending'
  | 'resolving'
  | 'resolved'
  | 'error'
  | 'manual_required'
  | 'low_confidence';

/**
 * Portfolio asset state (frontend representation)
 */
export interface PortfolioAsset {
  /** Temporary ID for React key */
  id: string;
  /** ISIN or Morningstar ID (user input) */
  identifier: string;
  /** Resolved asset from API */
  asset?: import('@/lib/api/assets').Asset;
  /** Percentage or amount */
  weight: number;
  /** Current resolution status */
  status: PortfolioAssetStatus;
  /** Error message if resolution failed */
  error?: string;
  /** Alternative assets for low confidence matches */
  alternatives?: import('@/lib/api/assets').AlternativeAsset[];
  /** True when ISIN enrichment is in progress */
  isinPending?: boolean;
}

/**
 * Allocation mode for portfolio weights
 */
export type AllocationMode = 'percentage' | 'amount';

/**
 * Portfolio state
 */
export interface PortfolioState {
  assets: PortfolioAsset[];
  allocationMode: AllocationMode;
  totalWeight: number;
  isValid: boolean;
}
