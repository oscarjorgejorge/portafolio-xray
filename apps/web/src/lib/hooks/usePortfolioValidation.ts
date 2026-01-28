'use client';

import { useMemo } from 'react';
import type { PortfolioAsset, AllocationMode } from '@/types';
import { VALIDATION } from '@/lib/constants';

interface UsePortfolioValidationOptions {
  assets: PortfolioAsset[];
  allocationMode: AllocationMode;
}

interface UsePortfolioValidationReturn {
  /** Total weight of all assets */
  totalWeight: number;
  /** Whether the portfolio is valid for generation */
  isValid: boolean;
  /** Whether all assets are resolved */
  allResolved: boolean;
  /** Remaining weight to reach 100% (for percentage mode) */
  remainingWeight: number;
}

/**
 * Hook for validating portfolio state.
 * Calculates total weight and checks if portfolio is valid for X-Ray generation.
 */
export function usePortfolioValidation({
  assets,
  allocationMode,
}: UsePortfolioValidationOptions): UsePortfolioValidationReturn {
  const totalWeight = useMemo(() => {
    return assets.reduce((sum, asset) => sum + (asset.weight || 0), 0);
  }, [assets]);

  const allResolved = useMemo(() => {
    return assets.every((asset) => asset.status === 'resolved' && asset.asset);
  }, [assets]);

  const isValid = useMemo(() => {
    if (assets.length === 0) return false;
    if (!allResolved) return false;

    const totalValid =
      allocationMode === 'percentage'
        ? Math.abs(totalWeight - VALIDATION.PERCENTAGE_TOTAL) <
          VALIDATION.PERCENTAGE_TOLERANCE
        : totalWeight > 0;

    return totalValid;
  }, [assets.length, allResolved, allocationMode, totalWeight]);

  const remainingWeight = useMemo(() => {
    return VALIDATION.PERCENTAGE_TOTAL - totalWeight;
  }, [totalWeight]);

  return {
    totalWeight,
    isValid,
    allResolved,
    remainingWeight,
  };
}
