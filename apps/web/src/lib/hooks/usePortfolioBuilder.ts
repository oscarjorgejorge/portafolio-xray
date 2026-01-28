'use client';

import { useState, useCallback, useMemo } from 'react';
import type { PortfolioAsset, AllocationMode, Asset, AssetType } from '@/types';
import { useAssetManagement } from './useAssetManagement';
import { usePortfolioValidation } from './usePortfolioValidation';
import { useXRayGeneration } from './useXRayGeneration';

interface UsePortfolioBuilderOptions {
  initialAssets?: PortfolioAsset[];
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

  // Actions
  setAllocationMode: (mode: AllocationMode) => void;
  handleAssetResolved: (newAsset: PortfolioAsset) => void;
  handleWeightChange: (id: string, weight: number) => void;
  handleRemove: (id: string) => void;
  handleAssetUpdated: (id: string, updatedAsset: Asset) => void;
  handleAlternativeSelected: (
    assetId: string,
    morningstarId: string,
    name: string,
    url: string,
    type: AssetType,
    ticker?: string
  ) => void;
  handleManualConfirmed: (
    assetId: string,
    morningstarId: string,
    name: string,
    url: string
  ) => void;
  handleGenerate: () => void;
  handleCopyUrl: () => void;
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
}: UsePortfolioBuilderOptions = {}): UsePortfolioBuilderReturn {
  // Allocation mode state
  const [allocationMode, setAllocationMode] =
    useState<AllocationMode>('percentage');

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
    initialAssets,
    // onAssetsChange will be set after xrayGeneration is created
  });

  // Validation hook
  const { totalWeight, isValid } = usePortfolioValidation({
    assets: assetManagement.assets,
    allocationMode,
  });

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

  // Handler: Alternative selected
  const handleAlternativeSelected = useCallback(
    (assetId: string, morningstarId: string, name: string, url: string, type: AssetType, ticker?: string) => {
      assetManagement.resolveAssetManually(assetId, morningstarId, name, url, type, ticker);
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

    // Actions (memoized for stable references)
    ...actions,
  };
}
