'use client';

import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { PortfolioAsset, AllocationMode } from '@/types';
import { generateXRay } from '@/lib/api/xray';
import { useShareableUrl } from './useShareableUrl';
import { VALIDATION } from '@/lib/constants';

interface UseXRayGenerationOptions {
  assets: PortfolioAsset[];
  allocationMode: AllocationMode;
  isValid: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseXRayGenerationReturn {
  /** Shareable URL path (without origin) */
  shareableUrl: string | null;
  /** Full shareable URL (with origin) */
  fullShareableUrl: string;
  /** Morningstar X-Ray URL */
  morningstarUrl: string | null;
  /** Whether the URL was recently copied */
  copied: boolean;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Error from generation, if any */
  generateError: Error | null;
  /** Generate X-Ray report */
  generate: () => void;
  /** Copy shareable URL to clipboard */
  copyUrl: () => Promise<void>;
  /** Open Morningstar PDF in new tab */
  openPdf: () => void;
  /** Clear all URLs */
  clearUrls: () => void;
}

/**
 * Hook for generating X-Ray reports and managing shareable URLs.
 */
export function useXRayGeneration({
  assets,
  allocationMode,
  isValid,
  onSuccess,
  onError,
}: UseXRayGenerationOptions): UseXRayGenerationReturn {
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

  const generateMutation = useMutation({
    mutationFn: generateXRay,
    onSuccess: (data) => {
      setUrls(data.shareableUrl, data.morningstarUrl);
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Error generating X-Ray:', error);
      clearUrls();
      onError?.(error);
    },
  });

  const generate = useCallback(() => {
    if (!isValid) return;

    let xrayAssets;
    if (allocationMode === 'amount') {
      const totalAmount = assets.reduce(
        (sum, asset) => sum + (asset.weight || 0),
        0
      );
      xrayAssets = assets
        .filter((asset) => asset.asset)
        .map((asset) => ({
          morningstarId: asset.asset!.morningstarId,
          weight:
            totalAmount > 0
              ? (asset.weight / totalAmount) * VALIDATION.PERCENTAGE_TOTAL
              : 0,
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

  const copyUrl = useCallback(() => {
    return copyToClipboard();
  }, [copyToClipboard]);

  const openPdf = useCallback(() => {
    openMorningstarPdf();
  }, [openMorningstarPdf]);

  return {
    shareableUrl,
    fullShareableUrl,
    morningstarUrl,
    copied,
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error,
    generate,
    copyUrl,
    openPdf,
    clearUrls,
  };
}
