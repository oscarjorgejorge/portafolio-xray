'use client';

import React from 'react';
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
import type { PortfolioAsset } from '@/types';
import { usePortfolioBuilder } from '@/lib/hooks/usePortfolioBuilder';

interface PortfolioBuilderProps {
  initialAssets?: PortfolioAsset[];
}

export const PortfolioBuilder: React.FC<PortfolioBuilderProps> = ({
  initialAssets = [],
}) => {
  const {
    assets,
    allocationMode,
    selectedAssetForAlternatives,
    selectedAssetForManual,
    showClearAllConfirmation,
    shareableUrl,
    fullShareableUrl,
    morningstarUrl,
    copied,
    showSuccessToast,
    totalWeight,
    isValid,
    isGenerating,
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
  } = usePortfolioBuilder({ initialAssets });

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
                  onAssetUpdated={handleAssetUpdated}
                  onOpenManualInput={(id) => {
                    const assetToEdit = getAssetById(id);
                    if (assetToEdit) {
                      setSelectedAssetForManual(assetToEdit);
                    }
                  }}
                  error={
                    asset.status === 'error' || asset.status === 'manual_required'
                      ? asset.error
                      : undefined
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
                  isLoading={isGenerating}
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
          onCancel={() => {
            handleRemove(selectedAssetForAlternatives.id);
            setSelectedAssetForAlternatives(null);
          }}
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
          onCancel={() => {
            handleRemove(selectedAssetForManual.id);
            setSelectedAssetForManual(null);
          }}
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
