'use client';

import React, { useState, useCallback, useEffect } from 'react';
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
import { useAuth } from '@/lib/auth';
import { AuthModal, getPendingSavePortfolio, clearPendingSavePortfolio, setPendingSavePortfolio } from '@/components/auth/AuthModal';
import { SavePortfolioModal } from './SavePortfolioModal';
import { Button } from '@/components/ui/Button';
import { SaveChangesModeModal } from './SaveChangesModeModal';

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
  portfolioId?: string;
  initialName?: string | null;
  initialDescription?: string | null;
  initialIsPublic?: boolean;
  resetBuilder?: boolean;
}

type SaveMode = 'create' | 'editCurrent' | 'createNew';

export const PortfolioBuilder: React.FC<PortfolioBuilderProps> = ({
  initialAssets = [],
  portfolioId,
  initialName,
  initialDescription,
  initialIsPublic = true,
  resetBuilder = false,
}) => {
  const t = useTranslations('portfolio');
  const tSave = useTranslations('savePortfolio');
  const { isAuthenticated, user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSavePortfolioModal, setShowSavePortfolioModal] = useState(false);
  const [showSaveSuccessToast, setShowSaveSuccessToast] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>('create');

  const canSavePortfolio = isAuthenticated && user?.emailVerified;

  const openSaveModal = useCallback(
    (mode: SaveMode) => {
      setSaveMode(mode);
      if (canSavePortfolio) {
        setShowSavePortfolioModal(true);
      } else {
        setPendingSavePortfolio();
        setShowAuthModal(true);
      }
    },
    [canSavePortfolio],
  );

  const handleAuthSuccess = useCallback(() => {
    setShowAuthModal(false);
    setShowSavePortfolioModal(true);
  }, []);

  useEffect(() => {
    if (getPendingSavePortfolio() && canSavePortfolio) {
      clearPendingSavePortfolio();
      setShowSavePortfolioModal(true);
    }
  }, [canSavePortfolio]);

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
    isDirty,
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
  } = usePortfolioBuilder({ initialAssets, reset: resetBuilder });

  const [showSaveModeModal, setShowSaveModeModal] = useState(false);

  const hasSavableAssets = assets.some(
    (asset) => asset.status === 'resolved' && asset.asset,
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">
              {t('builder')}
            </h3>
            {portfolioId && initialName && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {t('currentPortfolioLabel')}
                <span className="ml-1 text-slate-900">“{initialName}”</span>
              </span>
            )}
          </div>
          {hasSavableAssets && (
            <div className="flex flex-wrap gap-2 justify-end">
              {portfolioId ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!isDirty}
                  onClick={() => setShowSaveModeModal(true)}
                >
                  {tSave('saveChangesButton')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openSaveModal('create')}
                >
                  {tSave('button')}
                </Button>
              )}
            </div>
          )}
        </div>

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

      {/* Save Changes Mode Modal (only relevant when editing an existing portfolio) */}
      {portfolioId && (
        <SaveChangesModeModal
          isOpen={showSaveModeModal}
          onClose={() => setShowSaveModeModal(false)}
          onSelect={(mode) => {
            setShowSaveModeModal(false);
            openSaveModal(mode);
          }}
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

      {/* Auth Modal (when user clicks Save portfolio and is not logged in) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Save Portfolio Modal */}
      <SavePortfolioModal
        isOpen={showSavePortfolioModal}
        onClose={() => setShowSavePortfolioModal(false)}
        onSuccess={() => setShowSaveSuccessToast(true)}
        assets={assets}
        allocationMode={allocationMode}
        portfolioId={portfolioId}
        mode={portfolioId ? saveMode : 'create'}
        initialName={initialName ?? undefined}
        initialDescription={initialDescription ?? undefined}
        initialIsPublic={initialIsPublic}
      />

      {showSaveSuccessToast && (
        <Toast
          message={tSave('successToast')}
          variant="success"
          duration={3000}
          onClose={() => setShowSaveSuccessToast(false)}
        />
      )}
    </div>
  );
};
