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
  const router = useRouter();

  const generateMutation = useMutation({
    mutationFn: generateXRay,
    onSuccess: (data) => {
      // Navigate to X-Ray page with the shareable URL
      router.push(data.shareableUrl);
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
        ? Math.abs(totalWeight - 100) < 0.01
        : totalWeight > 0;
    return allResolved && totalValid;
  }, [assets, allocationMode, totalWeight]);

  const handleAssetResolved = (newAsset: PortfolioAsset) => {
    setAssets((prev) => [...prev, newAsset]);
    
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
  };

  const handleRemove = (id: string) => {
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
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

  const handleClearAll = () => {
    setShowClearAllConfirmation(true);
  };

  const handleConfirmClearAll = () => {
    setAssets([]);
    setShowClearAllConfirmation(false);
  };

  return (
    <div className="space-y-6">
      <Card title="Portfolio Builder">
        <AllocationModeToggle mode={allocationMode} onChange={setAllocationMode} />

        <div className="mb-6">
          <AssetInput onAssetResolved={handleAssetResolved} />
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
    </div>
  );
};

