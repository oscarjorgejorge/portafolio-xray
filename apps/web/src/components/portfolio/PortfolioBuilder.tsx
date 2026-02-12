'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { AssetInput } from './AssetInput';
import { AssetRow } from './AssetRow';
import { AllocationModeToggle } from './AllocationModeToggle';
import { PortfolioSummary } from './PortfolioSummary';
import { ShareableUrlSection } from './ShareableUrlSection';
import { Card } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';
import type { PortfolioAsset } from '@/types';
import { usePortfolioBuilder } from '@/lib/hooks/usePortfolioBuilder';

// Lazy load modal components - they are only rendered when needed
const AssetAlternatives = dynamic(
  () => import('./AssetAlternatives').then((mod) => mod.AssetAlternatives),
  { ssr: false }
);

const ManualAssetInput = dynamic(
  () => import('./ManualAssetInput').then((mod) => mod.ManualAssetInput),
  { ssr: false }
);

const ClearAllConfirmation = dynamic(
  () => import('./ClearAllConfirmation').then((mod) => mod.ClearAllConfirmation),
  { ssr: false }
);

interface PortfolioBuilderProps {
  initialAssets?: PortfolioAsset[];
}

export const PortfolioBuilder: React.FC<PortfolioBuilderProps> = ({
  initialAssets = [],
}) => {
  const t = useTranslations('portfolio');
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
    copyError,
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
      <Card title={t('builder')}>
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

            <PortfolioSummary
              totalWeight={totalWeight}
              allocationMode={allocationMode}
              isValid={isValid}
              isGenerating={isGenerating}
              onClearAll={handleClearAll}
              onGenerate={handleGenerate}
            />

            {/* Shareable URL Section - Show after successful generation */}
            {shareableUrl && fullShareableUrl && (
              <ShareableUrlSection
                fullShareableUrl={fullShareableUrl}
                morningstarUrl={morningstarUrl}
                copied={copied}
                copyError={copyError}
                onCopyUrl={handleCopyUrl}
                onOpenPDF={handleOpenPDF}
              />
            )}
          </>
        )}

        {assets.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p>{t('noAssets')}</p>
            <p className="text-sm mt-2">
              {t('noAssetsHint')}
            </p>
          </div>
        )}
      </Card>

      {/* Alternatives Modal */}
      {selectedAssetForAlternatives && selectedAssetForAlternatives.alternatives && (
        <AssetAlternatives
          identifier={selectedAssetForAlternatives.identifier}
          alternatives={selectedAssetForAlternatives.alternatives}
          onSelected={(payload) =>
            handleAlternativeSelected(selectedAssetForAlternatives.id, payload)
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
          message={t('successToast')}
          variant="success"
          duration={3000}
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </div>
  );
};
