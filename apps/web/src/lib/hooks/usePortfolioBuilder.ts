'use client';

import { useState, useMemo, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { PortfolioAsset, AllocationMode, AssetType, Asset } from '@/types';
import { generateXRay } from '@/lib/api/xray';
import { useShareableUrl } from './useShareableUrl';
import { VALIDATION } from '@/lib/constants';

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
    url: string
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

export function usePortfolioBuilder({
  initialAssets = [],
}: UsePortfolioBuilderOptions = {}): UsePortfolioBuilderReturn {
  // Core state
  const [assets, setAssets] = useState<PortfolioAsset[]>(initialAssets);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('percentage');

  // Modal states
  const [selectedAssetForAlternatives, setSelectedAssetForAlternatives] =
    useState<PortfolioAsset | null>(null);
  const [selectedAssetForManual, setSelectedAssetForManual] =
    useState<PortfolioAsset | null>(null);
  const [showClearAllConfirmation, setShowClearAllConfirmation] = useState(false);

  // Use shared URL hook
  const {
    shareableUrl,
    morningstarUrl,
    fullShareableUrl,
    copied,
    setUrls,
    copyToClipboard,
    openMorningstarPdf,
    clearUrls,
  } = useShareableUrl();

  // Toast state
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: generateXRay,
    onSuccess: (data) => {
      setUrls(data.shareableUrl, data.morningstarUrl);
      setShowSuccessToast(true);
    },
    onError: (error: Error) => {
      console.error('Error generating X-Ray:', error);
      clearUrls();
    },
  });

  // Calculate total weight
  const totalWeight = useMemo(() => {
    return assets.reduce((sum, asset) => sum + (asset.weight || 0), 0);
  }, [assets]);

  // Check if portfolio is valid
  const isValid = useMemo(() => {
    if (assets.length === 0) return false;
    const allResolved = assets.every(
      (asset) => asset.status === 'resolved' && asset.asset
    );
    const totalValid =
      allocationMode === 'percentage'
        ? Math.abs(totalWeight - VALIDATION.PERCENTAGE_TOTAL) < VALIDATION.PERCENTAGE_TOLERANCE
        : totalWeight > 0;
    return allResolved && totalValid;
  }, [assets, allocationMode, totalWeight]);

  // Handler: Asset resolved from input
  const handleAssetResolved = useCallback(
    (newAsset: PortfolioAsset) => {
      setAssets((prev) => [...prev, newAsset]);
      clearUrls();

      if (newAsset.status === 'low_confidence') {
        setSelectedAssetForAlternatives(newAsset);
      } else if (newAsset.status === 'manual_required') {
        setSelectedAssetForManual(newAsset);
      }
    },
    [clearUrls]
  );

  // Handler: Weight change
  const handleWeightChange = useCallback(
    (id: string, weight: number) => {
      setAssets((prev) =>
        prev.map((asset) => (asset.id === id ? { ...asset, weight } : asset))
      );
      clearUrls();
    },
    [clearUrls]
  );

  // Handler: Remove asset
  const handleRemove = useCallback(
    (id: string) => {
      setAssets((prev) => prev.filter((asset) => asset.id !== id));
      clearUrls();
    },
    [clearUrls]
  );

  // Handler: Asset updated (ISIN resolved)
  const handleAssetUpdated = useCallback((id: string, updatedAsset: Asset) => {
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

  // Handler: Alternative selected
  const handleAlternativeSelected = useCallback(
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
      setSelectedAssetForAlternatives(null);
    },
    []
  );

  // Handler: Manual confirmed
  const handleManualConfirmed = useCallback(
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
      setSelectedAssetForManual(null);
    },
    []
  );

  // Handler: Generate X-Ray
  const handleGenerate = useCallback(() => {
    if (!isValid) return;

    let xrayAssets;
    if (allocationMode === 'amount') {
      const totalAmount = assets.reduce((sum, asset) => sum + (asset.weight || 0), 0);
      xrayAssets = assets
        .filter((asset) => asset.asset)
        .map((asset) => ({
          morningstarId: asset.asset!.morningstarId,
          weight: totalAmount > 0 ? (asset.weight / totalAmount) * VALIDATION.PERCENTAGE_TOTAL : 0,
        }));
    } else {
      xrayAssets = assets
        .filter((asset) => asset.asset)
        .map((asset) => ({
          morningstarId: asset.asset!.morningstarId,
          weight: asset.weight,
        }));
    }

    generateMutation.mutate(xrayAssets);
  }, [isValid, allocationMode, assets, generateMutation]);

  // Handler: Copy URL
  const handleCopyUrl = useCallback(() => {
    copyToClipboard();
  }, [copyToClipboard]);

  // Handler: Clear all
  const handleClearAll = useCallback(() => {
    setShowClearAllConfirmation(true);
  }, []);

  // Handler: Confirm clear all
  const handleConfirmClearAll = useCallback(() => {
    setAssets([]);
    clearUrls();
    setShowClearAllConfirmation(false);
  }, [clearUrls]);

  // Handler: Open PDF
  const handleOpenPDF = useCallback(() => {
    openMorningstarPdf();
  }, [openMorningstarPdf]);

  // Helper: Get asset by ID
  const getAssetById = useCallback(
    (id: string) => assets.find((a) => a.id === id),
    [assets]
  );

  return {
    // State
    assets,
    allocationMode,
    selectedAssetForAlternatives,
    selectedAssetForManual,
    showClearAllConfirmation,
    shareableUrl,
    morningstarUrl,
    fullShareableUrl,
    copied,
    showSuccessToast,
    totalWeight,
    isValid,
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error,

    // Actions
    setAllocationMode,
    handleAssetResolved,
    handleWeightChange,
    handleRemove,
    handleAssetUpdated,
    handleAlternativeSelected,
    handleManualConfirmed,
    handleGenerate,
    handleCopyUrl,
    handleClearAll,
    handleConfirmClearAll,
    handleOpenPDF,
    setSelectedAssetForAlternatives,
    setSelectedAssetForManual,
    setShowClearAllConfirmation,
    setShowSuccessToast,
    getAssetById,
  };
}
