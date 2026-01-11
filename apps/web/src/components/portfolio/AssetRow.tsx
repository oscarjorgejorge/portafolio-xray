'use client';

import React from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PortfolioAsset, AllocationMode } from '@/types';

interface AssetRowProps {
  asset: PortfolioAsset;
  allocationMode: AllocationMode;
  onWeightChange: (id: string, weight: number) => void;
  onRemove: (id: string) => void;
  error?: string;
}

export const AssetRow: React.FC<AssetRowProps> = ({
  asset,
  allocationMode,
  onWeightChange,
  onRemove,
  error,
}) => {
  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    onWeightChange(asset.id, value);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {asset.asset ? (
            <div>
              <h4 className="font-semibold text-gray-900">{asset.asset.name}</h4>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                <span>
                  <span className="font-medium">ISIN:</span> {asset.asset.isin}
                </span>
                <span>
                  <span className="font-medium">Type:</span>{' '}
                  {asset.asset.type}
                </span>
                {asset.asset.ticker && (
                  <span>
                    <span className="font-medium">Ticker:</span>{' '}
                    {asset.asset.ticker}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h4 className="font-semibold text-gray-900">
                {asset.identifier}
              </h4>
              {asset.status === 'resolving' && (
                <p className="text-sm text-gray-500 mt-1">Resolving...</p>
              )}
              {asset.error && (
                <p className="text-sm text-red-600 mt-1">{asset.error}</p>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(asset.id)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Remove
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            type="number"
            label={
              allocationMode === 'percentage'
                ? 'Weight (%)'
                : 'Amount (€, $, etc.)'
            }
            value={asset.weight || ''}
            onChange={handleWeightChange}
            min="0"
            step={allocationMode === 'percentage' ? '0.01' : '0.01'}
            error={error}
            placeholder="0"
          />
        </div>
        {allocationMode === 'amount' && asset.weight > 0 && (
          <div className="pt-6 text-sm text-gray-600">
            {/* Percentage will be calculated by parent */}
          </div>
        )}
      </div>
    </div>
  );
};

