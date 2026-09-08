'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { PortfolioAsset, AllocationMode, Asset, AssetType } from '@/types';
import { useAssetManagement } from './useAssetManagement';
import { usePortfolioValidation } from './usePortfolioValidation';
import { useXRayGeneration } from './useXRayGeneration';

const PORTFOLIO_BUILDER_STORAGE_KEY = 'portfolioBuilderState';

function readStoredPortfolioBuilderState(): {
  assets: PortfolioAsset[];
  allocationMode: AllocationMode;
} | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(PORTFOLIO_BUILDER_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as {
      assets?: PortfolioAsset[];
      allocationMode?: AllocationMode;
    };

    return {
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      allocationMode: parsed.allocationMode || 'percentage',
    };
  } catch {
    return null;
  }
}

interface UsePortfolioBuilderOptions {
  initialAssets?: PortfolioAsset[];
  reset?: boolean;
  initialAllocationMode?: AllocationMode;
}

interface UsePortfolioBuilderReturn {
  // State
  assets: PortfolioAsset[];
  allocationMode: AllocationMode;
  selectedAssetForAlternatives: PortfolioAsset | null;
  selectedAssetForManual: PortfolioAsset | null;
  showClearAllConfirmation: boolean;
  shareableUrl: string | null;
  morningstarUrl: string | null;
  fullShareableUrl: string;
  copied: boolean;
  copyError: boolean;
  showSuccessToast: boolean;
  totalWeight: number;
  isValid: boolean;
  isGenerating: boolean;
  generateError: Error | null;
  holdingsUsingFallback: number;
  isDirty: boolean;

  // Actions
  setAllocationMode: (mode: AllocationMode) => void;
  handleAssetResolved: (newAsset: PortfolioAsset) => void;
  handleWeightChange: (id: string, weight: number) => void;
  handleRemove: (id: string) => void;
  handleAssetUpdated: (id: string, updatedAsset: Asset) => void;
  handleAlternativeSelected: (
    assetId: string,
    payload: {
      morningstarId: string;
      name: string;
      url: string;
      type: AssetType;
      ticker?: string;
      confirmedAsset?: Asset;
    }
  ) => void;
  handleManualConfirmed: (
    assetId: string,
    morningstarId: string,
    name: string,
    url: string
  ) => void;
  handleGenerate: () => void;
  handleCopyUrl: (urlOverride?: string) => void;
  handleClearAll: () => void;
  handleConfirmClearAll: () => void;
  handleOpenPDF: () => void;
  setSelectedAssetForAlternatives: (asset: PortfolioAsset | null) => void;
  setSelectedAssetForManual: (asset: PortfolioAsset | null) => void;
  setShowClearAllConfirmation: (show: boolean) => void;
  setShowSuccessToast: (show: boolean) => void;
  getAssetById: (id: string) => PortfolioAsset | undefined;
}

/**
 * Main hook for portfolio builder functionality.
 * Composes smaller hooks for asset management, validation, and X-Ray generation.
 */
export function usePortfolioBuilder({
  initialAssets = [],
  reset = false,
  initialAllocationMode,
}: UsePortfolioBuilderOptions = {}): UsePortfolioBuilderReturn {
  // Keep the first render identical on server and client. Restoring from
  // sessionStorage during useState would add saved assets only on the client
  // and cause a hydration mismatch (e.g. the Save button appearing).
  const [initialState, setInitialState] = useState<{
    assets: PortfolioAsset[];
    allocationMode: AllocationMode;
  }>(() => {
    if (reset) {
      return {
        assets: [],
        allocationMode: 'percentage',
      };
    }

    if (initialAssets.length > 0) {
      return {
        assets: initialAssets,
        allocationMode: initialAllocationMode || 'percentage',
      };
    }

    return {
      assets: [],
      allocationMode: 'percentage',
    };
  });
  const [storageHydrated, setStorageHydrated] = useState(
    reset || initialAssets.length > 0
  );

  // Allocation mode state
  const [allocationMode, setAllocationMode] = useState<AllocationMode>(
    initialState.allocationMode
  );

  // Modal states
  const [selectedAssetForAlternatives, setSelectedAssetForAlternatives] =
    useState<PortfolioAsset | null>(null);
  const [selectedAssetForManual, setSelectedAssetForManual] =
    useState<PortfolioAsset | null>(null);
  const [showClearAllConfirmation, setShowClearAllConfirmation] =
    useState(false);

  // Toast state
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Asset management hook with clearUrls callback
  const assetManagement = useAssetManagement({
    initialAssets: initialState.assets,
    // onAssetsChange will be set after xrayGeneration is created
  });

  // Restore sessionStorage after mount so the first client render matches SSR.
  useEffect(() => {
    if (reset || initialAssets.length > 0) {
      setStorageHydrated(true);
      return;
    }

    const stored = readStoredPortfolioBuilderState();
    if (
      stored &&
      (stored.assets.length > 0 || stored.allocationMode !== 'percentage')
    ) {
      setInitialState(stored);
      assetManagement.replaceAssets(stored.assets);
      setAllocationMode(stored.allocationMode);
    }
    setStorageHydrated(true);
    // Restore only once after hydration; later prop updates are handled elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist builder state so portfolio is not lost on redirects (e.g. auth flows)
  useEffect(() => {
    if (!storageHydrated) return;
    if (typeof window === 'undefined') return;

    const hasAssets = assetManagement.assets.length > 0;
    if (!hasAssets && allocationMode === 'percentage') {
      window.sessionStorage.removeItem(PORTFOLIO_BUILDER_STORAGE_KEY);
      return;
    }

    try {
      window.sessionStorage.setItem(
        PORTFOLIO_BUILDER_STORAGE_KEY,
        JSON.stringify({
          assets: assetManagement.assets,
          allocationMode,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [storageHydrated, assetManagement.assets, allocationMode]);

  // Validation hook
  const { totalWeight, isValid } = usePortfolioValidation({
    assets: assetManagement.assets,
    allocationMode,
  });

  const isDirty = useMemo(() => {
    if (allocationMode !== initialState.allocationMode) {
      return true;
    }

    const currentAssets = assetManagement.assets;
    const initialAssetsSnapshot = initialState.assets;

    if (currentAssets.length !== initialAssetsSnapshot.length) {
      return true;
    }

    for (let i = 0; i < currentAssets.length; i += 1) {
      const current = currentAssets[i];
      const initial = initialAssetsSnapshot[i];

      if (!initial) {
        return true;
      }

      const currentId =
        current.asset?.morningstarId ?? current.identifier.toUpperCase();
      const initialId =
        initial.asset?.morningstarId ?? initial.identifier.toUpperCase();

      if (currentId !== initialId) {
        return true;
      }

      if (current.weight !== initial.weight) {
        return true;
      }
    }

    return false;
  }, [allocationMode, assetManagement.assets, initialState.assets, initialState.allocationMode]);

  // X-Ray generation hook
  const xrayGeneration = useXRayGeneration({
    assets: assetManagement.assets,
    allocationMode,
    isValid,
    onSuccess: () => setShowSuccessToast(true),
  });

  // Handler: Asset resolved from input
  const handleAssetResolved = useCallback(
    (newAsset: PortfolioAsset) => {
      assetManagement.addAsset(newAsset);
      xrayGeneration.clearUrls();

      if (newAsset.status === 'low_confidence') {
        setSelectedAssetForAlternatives(newAsset);
      } else if (newAsset.status === 'manual_required') {
        setSelectedAssetForManual(newAsset);
      }
    },
    [assetManagement, xrayGeneration]
  );

  // Handler: Weight change
  const handleWeightChange = useCallback(
    (id: string, weight: number) => {
      assetManagement.updateWeight(id, weight);
      xrayGeneration.clearUrls();
    },
    [assetManagement, xrayGeneration]
  );

  // Handler: Remove asset
  const handleRemove = useCallback(
    (id: string) => {
      assetManagement.removeAsset(id);
      xrayGeneration.clearUrls();
    },
    [assetManagement, xrayGeneration]
  );

  // Handler: Alternative selected (use confirmed asset from API when present so UI shows correct type)
  const handleAlternativeSelected = useCallback(
    (
      assetId: string,
      payload: {
        morningstarId: string;
        name: string;
        url: string;
        type: AssetType;
        ticker?: string;
        confirmedAsset?: Asset;
      }
    ) => {
      if (payload.confirmedAsset) {
        assetManagement.resolveAssetWithConfirmed(assetId, payload.confirmedAsset);
      } else {
        assetManagement.resolveAssetManually(
          assetId,
          payload.morningstarId,
          payload.name,
          payload.url,
          payload.type,
          payload.ticker
        );
      }
      setSelectedAssetForAlternatives(null);
    },
    [assetManagement]
  );

  // Handler: Manual confirmed
  const handleManualConfirmed = useCallback(
    (assetId: string, morningstarId: string, name: string, url: string) => {
      assetManagement.resolveAssetManually(assetId, morningstarId, name, url);
      setSelectedAssetForManual(null);
    },
    [assetManagement]
  );

  // Handler: Clear all - memoized for stable reference
  const handleClearAll = useCallback(() => {
    setShowClearAllConfirmation(true);
  }, []);

  // Handler: Confirm clear all
  const handleConfirmClearAll = useCallback(() => {
    assetManagement.clearAll();
    xrayGeneration.clearUrls();
    setShowClearAllConfirmation(false);
  }, [assetManagement, xrayGeneration]);

  // Memoize actions object to prevent unnecessary re-renders in consumers
  const actions = useMemo(
    () => ({
      setAllocationMode,
      handleAssetResolved,
      handleWeightChange,
      handleRemove,
      handleAssetUpdated: assetManagement.updateAsset,
      handleAlternativeSelected,
      handleManualConfirmed,
      handleGenerate: xrayGeneration.generate,
      handleCopyUrl: xrayGeneration.copyUrl,
      handleClearAll,
      handleConfirmClearAll,
      handleOpenPDF: xrayGeneration.openPdf,
      setSelectedAssetForAlternatives,
      setSelectedAssetForManual,
      setShowClearAllConfirmation,
      setShowSuccessToast,
      getAssetById: assetManagement.getAssetById,
    }),
    [
      setAllocationMode,
      handleAssetResolved,
      handleWeightChange,
      handleRemove,
      assetManagement.updateAsset,
      handleAlternativeSelected,
      handleManualConfirmed,
      xrayGeneration.generate,
      xrayGeneration.copyUrl,
      handleClearAll,
      handleConfirmClearAll,
      xrayGeneration.openPdf,
      assetManagement.getAssetById,
    ]
  );

  return {
    // State (these change and should trigger re-renders)
    assets: assetManagement.assets,
    allocationMode,
    selectedAssetForAlternatives,
    selectedAssetForManual,
    showClearAllConfirmation,
    shareableUrl: xrayGeneration.shareableUrl,
    morningstarUrl: xrayGeneration.morningstarUrl,
    fullShareableUrl: xrayGeneration.fullShareableUrl,
    copied: xrayGeneration.copied,
    copyError: xrayGeneration.copyError,
    showSuccessToast,
    totalWeight,
    isValid,
    isGenerating: xrayGeneration.isGenerating,
    generateError: xrayGeneration.generateError,
    holdingsUsingFallback: xrayGeneration.holdingsUsingFallback,
    isDirty,

    // Actions (memoized for stable references)
    ...actions,
  };
}
