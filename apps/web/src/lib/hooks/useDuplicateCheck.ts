'use client';

import { useCallback } from 'react';
import type { PortfolioAsset } from '@/types';

interface ResolvedAssetInfo {
  isin?: string | null;
  morningstarId?: string;
}

/**
 * Hook to check for duplicate assets in a portfolio.
 * Checks by identifier (ISIN, ticker), resolved ISIN, or Morningstar ID.
 *
 * @param existingAssets - Array of existing portfolio assets
 * @returns Function to check if an asset is a duplicate
 */
export function useDuplicateCheck(existingAssets: PortfolioAsset[]) {
  /**
   * Check if an asset with the given identifier or resolved data already exists
   * @param identifier - The input identifier (ISIN, ticker, etc.)
   * @param resolvedAsset - Optional resolved asset data to check against
   * @returns true if duplicate found, false otherwise
   */
  const checkDuplicate = useCallback(
    (identifier: string, resolvedAsset?: ResolvedAssetInfo): boolean => {
      const normalizedIdentifier = identifier.toUpperCase();

      return existingAssets.some((existingAsset) => {
        // Check by identifier (ISIN, ticker, etc.)
        if (existingAsset.identifier.toUpperCase() === normalizedIdentifier) {
          return true;
        }

        // Check by ISIN if both have resolved assets
        if (
          existingAsset.asset?.isin &&
          resolvedAsset?.isin &&
          existingAsset.asset.isin.toUpperCase() ===
            resolvedAsset.isin.toUpperCase()
        ) {
          return true;
        }

        // Check by Morningstar ID if both have resolved assets
        if (
          existingAsset.asset?.morningstarId &&
          resolvedAsset?.morningstarId &&
          existingAsset.asset.morningstarId === resolvedAsset.morningstarId
        ) {
          return true;
        }

        return false;
      });
    },
    [existingAssets]
  );

  return { checkDuplicate };
}
