'use client';

import React, { memo } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { AllocationMode } from '@/types';

interface PortfolioSummaryProps {
  totalWeight: number;
  allocationMode: AllocationMode;
  isValid: boolean;
  isGenerating: boolean;
  onClearAll: () => void;
  onGenerate: () => void;
}

/**
 * Displays portfolio total weight and action buttons.
 * Shows validation warning when percentage mode doesn't equal 100%.
 */
export const PortfolioSummary = memo<PortfolioSummaryProps>(function PortfolioSummary({
  totalWeight,
  allocationMode,
  isValid,
  isGenerating,
  onClearAll,
  onGenerate,
}) {
  const isPercentageValid = Math.abs(totalWeight - 100) < 0.01;
  const remaining = 100 - totalWeight;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="text-sm text-slate-700">
          <span className="font-medium">Total:</span>{' '}
          {allocationMode === 'percentage' ? (
            <span className={isPercentageValid ? 'text-green-600' : 'text-red-600'}>
              {totalWeight.toFixed(2)}%
            </span>
          ) : (
            <span className="text-slate-900">{totalWeight.toFixed(2)}</span>
          )}
        </div>
        {allocationMode === 'percentage' && !isPercentageValid && (
          <Alert variant="warning" className="py-2 px-3 text-sm">
            Total must equal 100%. Remaining: {remaining.toFixed(2)}%
          </Alert>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClearAll}>
          Clear All
        </Button>
        <Button
          onClick={onGenerate}
          disabled={!isValid}
          isLoading={isGenerating}
        >
          Generate X-Ray
        </Button>
      </div>
    </div>
  );
});
