'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { PortfolioAsset, Asset, AssetType } from '@/types';

interface UseAssetManagementOptions {
  initialAssets?: PortfolioAsset[];
  onAssetsChange?: () => void;
}

interface UseAssetManagementReturn {
  assets: PortfolioAsset[];
  addAsset: (asset: PortfolioAsset) => void;
  removeAsset: (id: string) => void;
  updateWeight: (id: string, weight: number) => void;
  updateAsset: (id: string, updatedAsset: Asset) => void;
  resolveAssetManually: (
    assetId: string,
    morningstarId: string,
    name: string,
    url: string
  ) => void;
  clearAll: () => void;
  getAssetById: (id: string) => PortfolioAsset | undefined;
}

/**
 * Hook for managing portfolio assets (CRUD operations).
 * Handles adding, removing, updating, and resolving assets.
 */
export function useAssetManagement({
  initialAssets = [],
  onAssetsChange,
}: UseAssetManagementOptions = {}): UseAssetManagementReturn {
  const [assets, setAssets] = useState<PortfolioAsset[]>(initialAssets);

  // Sync state when initialAssets changes (e.g., from URL parsing)
  useEffect(() => {
    if (initialAssets.length > 0) {
      setAssets(initialAssets);
    }
  }, [initialAssets]);

  const addAsset = useCallback(
    (asset: PortfolioAsset) => {
      setAssets((prev) => [...prev, asset]);
      onAssetsChange?.();
    },
    [onAssetsChange]
  );

  const removeAsset = useCallback(
    (id: string) => {
      setAssets((prev) => prev.filter((asset) => asset.id !== id));
      onAssetsChange?.();
    },
    [onAssetsChange]
  );

  const updateWeight = useCallback(
    (id: string, weight: number) => {
      setAssets((prev) =>
        prev.map((asset) => (asset.id === id ? { ...asset, weight } : asset))
      );
      onAssetsChange?.();
    },
    [onAssetsChange]
  );

  const updateAsset = useCallback((id: string, updatedAsset: Asset) => {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.id === id
          ? {
              ...asset,
              asset: updatedAsset,
              isinPending: updatedAsset.isinPending || false,
            }
          : asset
      )
    );
  }, []);

  const resolveAssetManually = useCallback(
    (assetId: string, morningstarId: string, name: string, url: string) => {
      setAssets((prev) =>
        prev.map((asset) =>
          asset.id === assetId
            ? {
                ...asset,
                status: 'resolved' as const,
                asset: {
                  id: '',
                  isin: asset.identifier,
                  morningstarId,
                  name,
                  url,
                  type: 'FUND' as AssetType,
                  source: 'manual',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              }
            : asset
        )
      );
    },
    []
  );

  const clearAll = useCallback(() => {
    setAssets([]);
    onAssetsChange?.();
  }, [onAssetsChange]);

  // Create indexed Map for O(1) lookups instead of O(n) find()
  const assetsMap = useMemo(
    () => new Map(assets.map((a) => [a.id, a])),
    [assets]
  );

  const getAssetById = useCallback(
    (id: string) => assetsMap.get(id),
    [assetsMap]
  );

  return {
    assets,
    addAsset,
    removeAsset,
    updateWeight,
    updateAsset,
    resolveAssetManually,
    clearAll,
    getAssetById,
  };
}
