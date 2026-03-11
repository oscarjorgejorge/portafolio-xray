'use client';

import React, { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { AllocationMode } from '@/types';

interface PortfolioSummaryProps {
  totalWeight: number;
  allocationMode: AllocationMode;
  isValid: boolean;
  isGenerating: boolean;
  /** Whether there is already a generated X-Ray for the current state */
  hasGeneratedXRay: boolean;
  /** Whether the portfolio has unsaved changes compared to its initial state */
  isDirty: boolean;
  onClearAll: () => void;
  onGenerate: () => void;
  /** Called when user clicks "Save portfolio". Opens auth or save modal. */
  onSavePortfolio?: () => void;
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
  hasGeneratedXRay,
  isDirty,
  onClearAll,
  onGenerate,
  onSavePortfolio,
}) {
  const t = useTranslations('summary');
  const tSave = useTranslations('savePortfolio');
  const isPercentageValid = Math.abs(totalWeight - 100) < 0.01;
  const remaining = 100 - totalWeight;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="text-sm text-slate-700">
          <span className="font-medium">{t('total')}</span>{' '}
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
            {t('validationError')} {t('remaining')} {remaining.toFixed(2)}%
          </Alert>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {onSavePortfolio && (
          <Button
            variant="secondary"
            onClick={onSavePortfolio}
            disabled={!isValid}
          >
            {tSave('button')}
          </Button>
        )}
        <Button variant="secondary" onClick={onClearAll}>
          {t('clearAll')}
        </Button>
        <Button
          onClick={onGenerate}
          disabled={!isValid || (!isDirty && hasGeneratedXRay)}
          isLoading={isGenerating}
        >
          {t('generateXray')}
        </Button>
      </div>
    </div>
  );
});
