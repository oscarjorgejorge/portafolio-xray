'use client';

import React, { useState, useCallback, memo } from 'react';
import { useTranslations } from 'next-intl';
import { PortfolioAsset, AllocationMode } from '@/types';
import { Spinner } from '@/components/ui/Spinner';
import { InputNumber } from '@/components/ui/InputNumber';
import { AssetRowSkeleton } from '@/components/ui/Skeleton';
import { TrashIcon, ExternalLinkIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { EditableIsin } from './EditableIsin';
import { useIsinPolling } from '@/lib/hooks/useIsinPolling';
import type { Asset } from '@/types';

// ============================================
// Memoized sub-components for performance
// ============================================

interface WeightInputProps {
  value: number;
  onChange: (value: number) => void;
  allocationMode: AllocationMode;
  hasError: boolean;
  variant: 'mobile' | 'desktop';
  labels: { weightPercent: string; amount: string };
}

const WeightInput = memo<WeightInputProps>(function WeightInput({
  value,
  onChange,
  allocationMode,
  hasError,
  variant,
  labels,
}) {
  const label = allocationMode === 'percentage' ? labels.weightPercent : labels.amount;
  const isMobile = variant === 'mobile';
  const maxValue = allocationMode === 'percentage' ? 100 : undefined;

  return (
    <InputNumber
      value={value}
      onChange={onChange}
      min={0}
      max={maxValue}
      step={0.01}
      label={isMobile ? undefined : label}
      placeholder="0"
      aria-label={label}
      error={hasError ? ' ' : undefined}
      size={isMobile ? 'md' : 'sm'}
      className={cn(isMobile && 'flex-1')}
    />
  );
});
WeightInput.displayName = 'WeightInput';

interface RemoveButtonProps {
  onClick: () => void;
  showTooltip: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  className?: string;
  removeLabel: string;
}

const RemoveButton = memo<RemoveButtonProps>(function RemoveButton({
  onClick,
  showTooltip,
  onMouseEnter,
  onMouseLeave,
  className,
  removeLabel,
}) {
  return (
    <div className={cn('relative', className)}>
      <button
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
        aria-label={removeLabel}
      >
        <TrashIcon />
      </button>
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
          {removeLabel}
          <div className="absolute -top-1 right-2 h-2 w-2 bg-slate-900 rotate-45" />
        </div>
      )}
    </div>
  );
});
RemoveButton.displayName = 'RemoveButton';

interface ErrorMessageProps {
  error: string;
  className?: string;
}

const ErrorMessage = memo<ErrorMessageProps>(function ErrorMessage({
  error,
  className,
}) {
  return (
    <p className={cn('text-xs text-red-600', className)} role="alert">
      {error}
    </p>
  );
});
ErrorMessage.displayName = 'ErrorMessage';

// ============================================
// Main component
// ============================================

interface AssetRowProps {
  asset: PortfolioAsset;
  allocationMode: AllocationMode;
  onWeightChange: (id: string, weight: number) => void;
  onRemove: (id: string) => void;
  onOpenManualInput?: (id: string) => void;
  onAssetUpdated?: (id: string, updatedAsset: Asset) => void;
  error?: string;
  /** Show loading skeleton instead of content */
  isLoading?: boolean;
}

export const AssetRow = memo<AssetRowProps>(function AssetRow({
  asset,
  allocationMode,
  onWeightChange,
  onRemove,
  onOpenManualInput,
  onAssetUpdated,
  error,
  isLoading = false,
}) {
  const t = useTranslations('assetRow');
  const tCommon = useTranslations('common');
  const [showTooltip, setShowTooltip] = useState(false);
  
  const weightLabels = {
    weightPercent: t('weightPercent'),
    amount: t('amount'),
  };

  const handleWeightChange = useCallback(
    (value: number) => {
      onWeightChange(asset.id, value);
    },
    [asset.id, onWeightChange]
  );

  const handleRemove = useCallback(() => {
    onRemove(asset.id);
  }, [asset.id, onRemove]);

  const handleIsinResolved = useCallback(
    (updatedAsset: Asset) => {
      if (onAssetUpdated) {
        onAssetUpdated(asset.id, updatedAsset);
      }
    },
    [asset.id, onAssetUpdated]
  );

  const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
  const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

  const isinPending = asset.isinPending || asset.asset?.isinPending || false;
  useIsinPolling({
    assetId: asset.asset?.id,
    isinPending,
    onIsinResolved: handleIsinResolved,
  });

  const hasWeightError = Boolean(error && error !== asset.error);

  // Show skeleton when loading
  if (isLoading) {
    return <AssetRowSkeleton />;
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      {asset.asset ? (
        <>
          {/* Top row: Link, Name, Weight (desktop), X button */}
          <div className="flex items-start gap-2 mb-2">
            <div className="flex-1 min-w-0 pr-2">
              <h4 className="font-semibold text-slate-900 break-words leading-tight">
                {asset.asset.name}
                {asset.asset.url && (
                  <a
                    href={asset.asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex align-middle ml-1 mb-2 text-blue-600 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded flex-shrink-0"
                    aria-label={`Open ${asset.asset.name} on Morningstar`}
                    title="Open on Morningstar"
                  >
                    <ExternalLinkIcon />
                  </a>
                )}
              </h4>
              <div className="flex items-center gap-2 sm:gap-4 text-sm text-slate-600 mt-1 flex-wrap">
                <span className="font-medium uppercase">{asset.asset.type}</span>
                {asset.asset.ticker && (
                  <span>
                    <span className="font-medium">{t('ticker')}</span> {asset.asset.ticker}
                  </span>
                )}
                {isinPending ? (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Spinner size="sm" className="text-blue-500" />
                    <span className="text-xs">{t('fetchingIsin')}</span>
                  </span>
                ) : (
                  <EditableIsin
                    assetId={asset.asset.id}
                    currentIsin={asset.asset.isin}
                    isinManual={asset.asset.isinManual}
                    onIsinUpdated={handleIsinResolved}
                  />
                )}
                {asset.asset.morningstarId && (
                  <span>
                    <span className="font-medium">{t('morningstarId')}</span> {asset.asset.morningstarId}
                  </span>
                )}
              </div>
              {/* Mobile: Weight input */}
              <div className="md:hidden flex items-center gap-2 mt-2">
                <label className="text-xs font-medium text-slate-700 whitespace-nowrap">
                  {allocationMode === 'percentage' ? t('weightPercent') : t('amount')}
                </label>
                <WeightInput
                  value={asset.weight}
                  onChange={handleWeightChange}
                  allocationMode={allocationMode}
                  hasError={hasWeightError}
                  variant="mobile"
                  labels={weightLabels}
                />
              </div>
            </div>
            {/* Desktop: Weight and X button */}
            <div className="hidden md:flex items-start gap-2 flex-shrink-0 ml-auto">
              <WeightInput
                value={asset.weight}
                onChange={handleWeightChange}
                allocationMode={allocationMode}
                hasError={hasWeightError}
                variant="desktop"
                labels={weightLabels}
              />
              <RemoveButton
                onClick={handleRemove}
                showTooltip={showTooltip}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="flex items-start"
                removeLabel={tCommon('remove')}
              />
            </div>
            {/* Mobile: Remove button */}
            <div className="md:hidden flex-shrink-0">
              <RemoveButton
                onClick={handleRemove}
                showTooltip={showTooltip}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="mt-0.5"
                removeLabel={tCommon('remove')}
              />
            </div>
          </div>
          {/* Error message */}
          {hasWeightError && (
            <>
              <div className="md:hidden mt-2">
                <ErrorMessage error={error!} />
              </div>
              <ErrorMessage error={error!} className="hidden md:block mb-2" />
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex items-start gap-2 flex-wrap mb-2">
            <h4 className="font-semibold text-slate-900 flex-1 min-w-0 break-words">
              {asset.identifier}
            </h4>
            {/* Desktop: Weight and X button */}
            <div className="hidden md:flex items-start gap-2 flex-shrink-0">
              <WeightInput
                value={asset.weight}
                onChange={handleWeightChange}
                allocationMode={allocationMode}
                hasError={hasWeightError}
                variant="desktop"
                labels={weightLabels}
              />
              <RemoveButton
                onClick={handleRemove}
                showTooltip={showTooltip}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="flex items-start pt-6"
                removeLabel={tCommon('remove')}
              />
            </div>
            {/* Mobile: Remove button */}
            <div className="md:hidden flex-shrink-0">
              <RemoveButton
                onClick={handleRemove}
                showTooltip={showTooltip}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="mt-0.5"
                removeLabel={tCommon('remove')}
              />
            </div>
          </div>
          {/* Mobile: Weight input */}
          <div className="md:hidden mb-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {allocationMode === 'percentage' ? t('weightPercent') : t('amount')}
            </label>
            <WeightInput
              value={asset.weight}
              onChange={handleWeightChange}
              allocationMode={allocationMode}
              hasError={hasWeightError}
              variant="mobile"
              labels={weightLabels}
            />
            {hasWeightError && <ErrorMessage error={error!} className="mt-1" />}
          </div>
          {asset.status === 'resolving' && (
            <div className="flex items-center gap-2 text-slate-500">
              <Spinner size="sm" className="text-blue-500" />
              <span className="text-sm">{t('resolving')}</span>
            </div>
          )}
          {asset.error && (
            <div role="alert">
              <p className="text-sm text-red-600">{asset.error}</p>
              {(asset.status === 'manual_required' || asset.status === 'error') && onOpenManualInput && (
                <button
                  onClick={() => onOpenManualInput(asset.id)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                >
                  {t('enterManually')}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
});
AssetRow.displayName = 'AssetRow';
