'use client';

import React, { useState, useCallback } from 'react';
import { PortfolioAsset, AllocationMode } from '@/types';
import { Spinner } from '@/components/ui/Spinner';
import { TrashIcon, ExternalLinkIcon } from '@/components/ui/Icons';
import { EditableIsin } from './EditableIsin';
import { useIsinPolling } from '@/lib/hooks/useIsinPolling';
import type { Asset } from '@/types';

// ============================================
// Sub-components to reduce code duplication
// ============================================

interface WeightInputProps {
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  allocationMode: AllocationMode;
  hasError: boolean;
  variant: 'mobile' | 'desktop';
}

const WeightInput: React.FC<WeightInputProps> = ({
  value,
  onChange,
  allocationMode,
  hasError,
  variant,
}) => {
  const label = allocationMode === 'percentage' ? 'Weight (%)' : 'Amount';
  const isMobile = variant === 'mobile';

  return (
    <div className={isMobile ? 'flex-1' : 'w-24'}>
      <label
        className={`${isMobile ? 'text-xs' : 'block text-xs'} font-medium text-slate-700 ${isMobile ? 'whitespace-nowrap' : 'mb-1'}`}
      >
        {!isMobile && label}
      </label>
      <input
        type="number"
        inputMode="decimal"
        value={value || ''}
        onChange={onChange}
        min="0"
        step="0.01"
        placeholder="0"
        aria-label={label}
        aria-invalid={hasError}
        className={`
          ${isMobile ? 'flex-1 px-3 py-2' : 'w-full px-2 py-1.5'} border rounded-lg text-sm
          text-slate-900 bg-white
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          ${hasError ? 'border-red-500' : 'border-slate-300'}
        `}
      />
    </div>
  );
};

interface RemoveButtonProps {
  onClick: () => void;
  showTooltip: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  className?: string;
}

const RemoveButton: React.FC<RemoveButtonProps> = ({
  onClick,
  showTooltip,
  onMouseEnter,
  onMouseLeave,
  className = '',
}) => (
  <div className={`relative ${className}`}>
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
      aria-label="Remove asset"
    >
      <TrashIcon />
    </button>
    {showTooltip && (
      <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
        Remove
        <div className="absolute -top-1 right-2 h-2 w-2 bg-slate-900 rotate-45"></div>
      </div>
    )}
  </div>
);

interface ErrorMessageProps {
  error: string;
  className?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, className = '' }) => (
  <p className={`text-xs text-red-600 ${className}`} role="alert">
    {error}
  </p>
);

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
}

export const AssetRow: React.FC<AssetRowProps> = ({
  asset,
  allocationMode,
  onWeightChange,
  onRemove,
  onOpenManualInput,
  onAssetUpdated,
  error,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    onWeightChange(asset.id, value);
  };

  const handleIsinResolved = useCallback(
    (updatedAsset: Asset) => {
      if (onAssetUpdated) {
        onAssetUpdated(asset.id, updatedAsset);
      }
    },
    [asset.id, onAssetUpdated]
  );

  const isinPending = asset.isinPending || asset.asset?.isinPending || false;
  useIsinPolling({
    assetId: asset.asset?.id,
    isinPending,
    onIsinResolved: handleIsinResolved,
  });

  const hasWeightError = Boolean(error && error !== asset.error);
  const handleRemove = () => onRemove(asset.id);
  const tooltipHandlers = {
    onMouseEnter: () => setShowTooltip(true),
    onMouseLeave: () => setShowTooltip(false),
  };

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
                    <span className="font-medium">Ticker:</span> {asset.asset.ticker}
                  </span>
                )}
                {isinPending ? (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Spinner size="sm" className="text-blue-500" />
                    <span className="text-xs">Fetching ISIN...</span>
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
                    <span className="font-medium">Morningstar ID:</span> {asset.asset.morningstarId}
                  </span>
                )}
              </div>
              {/* Mobile: Weight input */}
              <div className="md:hidden flex items-center gap-2 mt-2">
                <label className="text-xs font-medium text-slate-700 whitespace-nowrap">
                  {allocationMode === 'percentage' ? 'Weight (%)' : 'Amount'}
                </label>
                <WeightInput
                  value={asset.weight}
                  onChange={handleWeightChange}
                  allocationMode={allocationMode}
                  hasError={hasWeightError}
                  variant="mobile"
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
              />
              <RemoveButton
                onClick={handleRemove}
                showTooltip={showTooltip}
                {...tooltipHandlers}
                className="flex items-start"
              />
            </div>
            {/* Mobile: Remove button */}
            <div className="md:hidden flex-shrink-0">
              <RemoveButton
                onClick={handleRemove}
                showTooltip={showTooltip}
                {...tooltipHandlers}
                className="mt-0.5"
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
              />
              <RemoveButton
                onClick={handleRemove}
                showTooltip={showTooltip}
                {...tooltipHandlers}
                className="flex items-start pt-6"
              />
            </div>
            {/* Mobile: Remove button */}
            <div className="md:hidden flex-shrink-0">
              <RemoveButton
                onClick={handleRemove}
                showTooltip={showTooltip}
                {...tooltipHandlers}
                className="mt-0.5"
              />
            </div>
          </div>
          {/* Mobile: Weight input */}
          <div className="md:hidden mb-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {allocationMode === 'percentage' ? 'Weight (%)' : 'Amount'}
            </label>
            <WeightInput
              value={asset.weight}
              onChange={handleWeightChange}
              allocationMode={allocationMode}
              hasError={hasWeightError}
              variant="mobile"
            />
            {hasWeightError && <ErrorMessage error={error!} className="mt-1" />}
          </div>
          {asset.status === 'resolving' && (
            <p className="text-sm text-slate-500">Resolving...</p>
          )}
          {asset.error && (
            <div role="alert">
              <p className="text-sm text-red-600">{asset.error}</p>
              {(asset.status === 'manual_required' || asset.status === 'error') && onOpenManualInput && (
                <button
                  onClick={() => onOpenManualInput(asset.id)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                >
                  Enter Morningstar ID manually
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
