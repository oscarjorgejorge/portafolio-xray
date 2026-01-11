'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { AssetInput } from './AssetInput';
import { AssetRow } from './AssetRow';
import { AllocationModeToggle } from './AllocationModeToggle';
import { AssetAlternatives } from './AssetAlternatives';
import { ManualAssetInput } from './ManualAssetInput';
import { ClearAllConfirmation } from './ClearAllConfirmation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Toast } from '@/components/ui/Toast';
import type { PortfolioAsset, AllocationMode } from '@/types';
import { useMutation } from '@tanstack/react-query';
import { generateXRay } from '@/lib/api/xray';
import { useRouter } from 'next/navigation';
import { confirmAsset, type AssetType } from '@/lib/api/assets';

interface PortfolioBuilderProps {
  initialAssets?: PortfolioAsset[];
}

export const PortfolioBuilder: React.FC<PortfolioBuilderProps> = ({
  initialAssets = [],
}) => {
  const [assets, setAssets] = useState<PortfolioAsset[]>(initialAssets);
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('percentage');
  const [selectedAssetForAlternatives, setSelectedAssetForAlternatives] =
    useState<PortfolioAsset | null>(null);
  const [selectedAssetForManual, setSelectedAssetForManual] =
    useState<PortfolioAsset | null>(null);
  const [showClearAllConfirmation, setShowClearAllConfirmation] = useState(false);
  const [shareableUrl, setShareableUrl] = useState<string | null>(null);
  const [morningstarUrl, setMorningstarUrl] = useState<string | null>(null);
  const [fullShareableUrl, setFullShareableUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const router = useRouter();

  const generateMutation = useMutation({
    mutationFn: generateXRay,
    onSuccess: (data) => {
      setShareableUrl(data.shareableUrl);
      setMorningstarUrl(data.morningstarUrl);
      // Build full URL with domain
      if (typeof window !== 'undefined') {
        setFullShareableUrl(`${window.location.origin}${data.shareableUrl}`);
      }
      // Show success toast notification
      setShowSuccessToast(true);
    },
    onError: (error: Error) => {
      console.error('Error generating X-Ray:', error);
      setShareableUrl(null);
      setMorningstarUrl(null);
      setFullShareableUrl('');
    },
  });

  const handleOpenPDF = () => {
    if (morningstarUrl) {
      window.open(morningstarUrl, '_blank');
    }
  };

  // Update full URL when shareableUrl changes (client-side only)
  useEffect(() => {
    if (shareableUrl && typeof window !== 'undefined') {
      setFullShareableUrl(`${window.location.origin}${shareableUrl}`);
    }
  }, [shareableUrl]);

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
        ? Math.abs(totalWeight - 100) < 0.01
        : totalWeight > 0;
    return allResolved && totalValid;
  }, [assets, allocationMode, totalWeight]);

  // Helper function to clear shareable URLs when portfolio changes
  const clearShareableUrls = () => {
    setShareableUrl(null);
    setMorningstarUrl(null);
    setFullShareableUrl('');
  };

  const handleAssetResolved = (newAsset: PortfolioAsset) => {
    setAssets((prev) => [...prev, newAsset]);
    clearShareableUrls();

    // Handle different statuses
    if (newAsset.status === 'low_confidence') {
      setSelectedAssetForAlternatives(newAsset);
    } else if (newAsset.status === 'manual_required') {
      setSelectedAssetForManual(newAsset);
    }
  };

  const handleWeightChange = (id: string, weight: number) => {
    setAssets((prev) =>
      prev.map((asset) => (asset.id === id ? { ...asset, weight } : asset))
    );
    clearShareableUrls();
  };

  const handleRemove = (id: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
    clearShareableUrls();
  };

  const handleAlternativeSelected = (
    assetId: string,
    morningstarId: string,
    name: string,
    url: string
  ) => {
    // Update the asset with resolved data
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
  };

  const handleManualConfirmed = (
    assetId: string,
    morningstarId: string,
    name: string,
    url: string
  ) => {
    // Update the asset with confirmed data
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
  };

  const handleGenerate = () => {
    if (!isValid) return;

    const xrayAssets = assets
      .filter((asset) => asset.asset)
      .map((asset) => ({
        morningstarId: asset.asset!.morningstarId,
        weight: asset.weight,
      }));

    generateMutation.mutate(xrayAssets);
  };

  const handleCopyUrl = () => {
    if (fullShareableUrl) {
      navigator.clipboard.writeText(fullShareableUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleClearAll = () => {
    setShowClearAllConfirmation(true);
  };

  const handleConfirmClearAll = () => {
    setAssets([]);
    setShareableUrl(null);
    setMorningstarUrl(null);
    setFullShareableUrl('');
    setShowClearAllConfirmation(false);
  };

  return (
    <div className="space-y-6">
      <Card title="Portfolio Builder">
        <AllocationModeToggle mode={allocationMode} onChange={setAllocationMode} />

        <div className="mb-6">
          <AssetInput
            onAssetResolved={handleAssetResolved}
            existingAssets={assets}
          />
        </div>

        {assets.length > 0 && (
          <>
            <div className="space-y-4 mb-4">
              {assets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  allocationMode={allocationMode}
                  onWeightChange={handleWeightChange}
                  onRemove={handleRemove}
                  onOpenManualInput={(id) => {
                    const assetToEdit = assets.find((a) => a.id === id);
                    if (assetToEdit) {
                      setSelectedAssetForManual(assetToEdit);
                    }
                  }}
                  error={
                    asset.status === 'error' || asset.status === 'manual_required' ? asset.error : undefined
                  }
                />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="text-sm text-slate-700">
                  <span className="font-medium">Total:</span>{' '}
                  {allocationMode === 'percentage' ? (
                    <span
                      className={
                        Math.abs(totalWeight - 100) < 0.01
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {totalWeight.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-slate-900">{totalWeight.toFixed(2)}</span>
                  )}
                </div>
                {allocationMode === 'percentage' &&
                  Math.abs(totalWeight - 100) >= 0.01 && (
                    <Alert variant="warning" className="py-2 px-3 text-sm">
                      Total must equal 100%. Remaining:{' '}
                      {(100 - totalWeight).toFixed(2)}%
                    </Alert>
                  )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleClearAll}>
                  Clear All
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!isValid}
                  isLoading={generateMutation.isPending}
                >
                  Generate X-Ray
                </Button>
              </div>
            </div>

            {/* Shareable URL Section - Show after successful generation */}
            {shareableUrl && fullShareableUrl && (
              <div className="pt-4 border-t border-slate-200">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Shareable Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={fullShareableUrl}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                      />
                      <Button
                        onClick={handleCopyUrl}
                        variant="secondary"
                        size="sm"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Share this link to recreate the portfolio
                    </p>
                  </div>
                  <Button
                    onClick={handleOpenPDF}
                    className="w-full"
                    disabled={!morningstarUrl}
                  >
                    View X-Ray Report
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {assets.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p>No assets added yet.</p>
            <p className="text-sm mt-2">
              Enter an ISIN, Morningstar ID, or ticker above to get started.
            </p>
          </div>
        )}
      </Card>

      {/* Alternatives Modal */}
      {selectedAssetForAlternatives && selectedAssetForAlternatives.alternatives && (
        <AssetAlternatives
          identifier={selectedAssetForAlternatives.identifier}
          alternatives={selectedAssetForAlternatives.alternatives}
          onSelected={(morningstarId, name, url) =>
            handleAlternativeSelected(
              selectedAssetForAlternatives.id,
              morningstarId,
              name,
              url
            )
          }
          onCancel={() => setSelectedAssetForAlternatives(null)}
        />
      )}

      {/* Manual Input Modal */}
      {selectedAssetForManual && (
        <ManualAssetInput
          identifier={selectedAssetForManual.identifier}
          onConfirmed={(morningstarId, name, url) =>
            handleManualConfirmed(
              selectedAssetForManual.id,
              morningstarId,
              name,
              url
            )
          }
          onCancel={() => setSelectedAssetForManual(null)}
        />
      )}

      {/* Clear All Confirmation Modal */}
      {showClearAllConfirmation && (
        <ClearAllConfirmation
          onConfirm={handleConfirmClearAll}
          onCancel={() => setShowClearAllConfirmation(false)}
        />
      )}

      {/* Success Toast Notification */}
      {showSuccessToast && (
        <Toast
          message="X-Ray generated successfully!"
          variant="success"
          duration={3000}
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </div>
  );
};

