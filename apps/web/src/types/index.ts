import type { Asset, AssetType, AlternativeAsset } from '@/lib/api/assets';

/**
 * Portfolio asset state (frontend representation)
 */
export interface PortfolioAsset {
  id: string; // Temporary ID for React key
  identifier: string; // ISIN or Morningstar ID (user input)
  asset?: Asset; // Resolved asset from API
  weight: number; // Percentage or amount
  status:
    | 'pending'
    | 'resolving'
    | 'resolved'
    | 'error'
    | 'manual_required'
    | 'low_confidence';
  error?: string;
  alternatives?: AlternativeAsset[];
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

