'use client';

import React, { useState } from 'react';
import { PortfolioAsset, AllocationMode } from '@/types';

interface AssetRowProps {
  asset: PortfolioAsset;
  allocationMode: AllocationMode;
  onWeightChange: (id: string, weight: number) => void;
  onRemove: (id: string) => void;
  onOpenManualInput?: (id: string) => void;
  error?: string;
}

export const AssetRow: React.FC<AssetRowProps> = ({
  asset,
  allocationMode,
  onWeightChange,
  onRemove,
  onOpenManualInput,
  error,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    onWeightChange(asset.id, value);
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      {asset.asset ? (
        <>
          {/* Top row: Link, Name, Weight (desktop), X button */}
          <div className="flex items-start gap-2 flex-wrap mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-900 break-words leading-tight">
                {asset.asset.name}
                {asset.asset.url && (
                  <a
                    href={asset.asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex align-middle ml-1 mb-2 text-blue-600 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
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
              <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                <span>{asset.asset.isin}</span>
                <span>
                  <span className="font-medium">Type:</span> {asset.asset.type}
                </span>
              </div>
            </div>
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
            {/* Mobile: X button on the right */}
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
          {error && error !== asset.error && (
            <p className="hidden md:block mb-2 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          {/* Bottom row: Ticker, etc. */}
          {asset.asset.ticker && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span>
                <span className="font-medium">Ticker:</span>{' '}
                {asset.asset.ticker}
              </span>
            </div>
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

