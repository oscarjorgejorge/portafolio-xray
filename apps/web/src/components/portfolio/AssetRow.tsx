'use client';

import React, { useState, useCallback } from 'react';
import { PortfolioAsset, AllocationMode } from '@/types';
import { Spinner } from '@/components/ui/Spinner';
import { EditableIsin } from './EditableIsin';
import { useIsinPolling } from '@/lib/hooks/useIsinPolling';
import type { Asset } from '@/lib/api/assets';

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

  // Handle ISIN polling callback
  const handleIsinResolved = useCallback(
    (updatedAsset: Asset) => {
      if (onAssetUpdated) {
        onAssetUpdated(asset.id, updatedAsset);
      }
    },
    [asset.id, onAssetUpdated]
  );

  // Use ISIN polling hook
  const isinPending = asset.isinPending || asset.asset?.isinPending || false;
  useIsinPolling({
    assetId: asset.asset?.id,
    isinPending,
    onIsinResolved: handleIsinResolved,
  });

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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                )}
              </h4>
              <div className="flex items-center gap-2 sm:gap-4 text-sm text-slate-600 mt-1 flex-wrap">
                <span className="font-medium uppercase">{asset.asset.type}</span>
                {/* Show ticker if available */}
                {asset.asset.ticker && (
                  <span>
                    <span className="font-medium">Ticker:</span> {asset.asset.ticker}
                  </span>
                )}
                {/* Show ISIN section: pending spinner, editable ISIN, or nothing */}
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
                <input
                  type="number"
                  value={asset.weight || ''}
                  onChange={handleWeightChange}
                  min="0"
                  step={allocationMode === 'percentage' ? '0.01' : '0.01'}
                  placeholder="0"
                  className={`
                    flex-1 px-3 py-2 border rounded-lg text-sm
                    text-slate-900 bg-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${error && error !== asset.error ? 'border-red-500' : 'border-slate-300'}
                  `}
                />
              </div>
            </div>
            {/* Desktop: Weight and X button on the right */}
            <div className="hidden md:flex items-start gap-2 flex-shrink-0 ml-auto">
              <div className="w-24">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {allocationMode === 'percentage' ? 'Weight (%)' : 'Amount'}
                </label>
                <input
                  type="number"
                  value={asset.weight || ''}
                  onChange={handleWeightChange}
                  min="0"
                  step={allocationMode === 'percentage' ? '0.01' : '0.01'}
                  placeholder="0"
                  className={`
                    w-full px-2 py-1.5 border rounded-lg text-sm
                    text-slate-900 bg-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${error && error !== asset.error ? 'border-red-500' : 'border-slate-300'}
                  `}
                />
              </div>
              <div className="relative flex items-start">
                <button
                  onClick={() => onRemove(asset.id)}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="px-1.5 pb-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                  aria-label="Remove asset"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </button>
                {showTooltip && (
                  <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
                    Remove
                    <div className="absolute -top-1 right-2 h-2 w-2 bg-slate-900 rotate-45"></div>
                  </div>
                )}
              </div>
            </div>
            {/* Mobile: Trash button on the right */}
            <div className="md:hidden relative flex-shrink-0">
              <button
                onClick={() => onRemove(asset.id)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="px-1.5 pb-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 mt-0.5"
                aria-label="Remove asset"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
              </button>
              {showTooltip && (
                <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
                  Remove
                  <div className="absolute -top-1 right-2 h-2 w-2 bg-slate-900 rotate-45"></div>
                </div>
              )}
            </div>
          </div>
          {/* Mobile: Error message */}
          {error && error !== asset.error && (
            <div className="md:hidden mt-2">
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            </div>
          )}
          {/* Desktop: Error message */}
          {error && error !== asset.error && (
            <p className="hidden md:block mb-2 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex items-start gap-2 flex-wrap mb-2">
            <h4 className="font-semibold text-slate-900 flex-1 min-w-0 break-words">
              {asset.identifier}
            </h4>
            {/* Desktop: Weight and X button on the right */}
            <div className="hidden md:flex items-start gap-2 flex-shrink-0">
              <div className="w-24">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {allocationMode === 'percentage' ? 'Weight (%)' : 'Amount'}
                </label>
                <input
                  type="number"
                  value={asset.weight || ''}
                  onChange={handleWeightChange}
                  min="0"
                  step={allocationMode === 'percentage' ? '0.01' : '0.01'}
                  placeholder="0"
                  className={`
                    w-full px-2 py-1.5 border rounded-lg text-sm
                    text-slate-900 bg-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${error && error !== asset.error ? 'border-red-500' : 'border-slate-300'}
                  `}
                />
              </div>
              <div className="relative flex items-start pt-6">
                <button
                  onClick={() => onRemove(asset.id)}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                  aria-label="Remove asset"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </button>
                {showTooltip && (
                  <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
                    Remove
                    <div className="absolute -top-1 right-2 h-2 w-2 bg-slate-900 rotate-45"></div>
                  </div>
                )}
              </div>
            </div>
            {/* Mobile: X button on the right */}
            <div className="md:hidden relative flex-shrink-0">
              <button
                onClick={() => onRemove(asset.id)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 mt-0.5"
                aria-label="Remove asset"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              {showTooltip && (
                <div className="absolute right-0 top-full mt-1 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
                  Remove
                  <div className="absolute -top-1 right-2 h-2 w-2 bg-slate-900 rotate-45"></div>
                </div>
              )}
            </div>
          </div>
          {/* Mobile: Weight input below the text */}
          <div className="md:hidden mb-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {allocationMode === 'percentage' ? 'Weight (%)' : 'Amount'}
            </label>
            <input
              type="number"
              value={asset.weight || ''}
              onChange={handleWeightChange}
              min="0"
              step={allocationMode === 'percentage' ? '0.01' : '0.01'}
              placeholder="0"
              className={`
                w-full px-3 py-2 border rounded-lg text-sm
                text-slate-900 bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                ${error && error !== asset.error ? 'border-red-500' : 'border-slate-300'}
              `}
            />
            {error && error !== asset.error && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>
          {asset.status === 'resolving' && (
            <p className="text-sm text-slate-500">Resolving...</p>
          )}
          {asset.error && (
            <div>
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

