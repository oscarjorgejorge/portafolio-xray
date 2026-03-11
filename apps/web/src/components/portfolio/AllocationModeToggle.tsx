'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AllocationMode } from '@/types';
import { InfoIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

interface AllocationModeToggleProps {
  mode: AllocationMode;
  onChange: (mode: AllocationMode) => void;
}

export const AllocationModeToggle: React.FC<AllocationModeToggleProps> = ({
  mode,
  onChange,
}) => {
  const t = useTranslations('allocation');
  const [showInfo, setShowInfo] = useState(false);
  
  return (
    <div className="flex items-center space-x-4 mb-4">
      <span className="text-sm font-medium text-slate-700">{t('modeLabel')}</span>
      <div className="flex bg-slate-200 rounded-lg p-1">
        <button
          type="button"
          onClick={() => onChange('percentage')}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${
              mode === 'percentage'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }
          `}
        >
          {t('percentage')}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => onChange('amount')}
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1
              ${
                mode === 'amount'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }
            `}
            aria-label={
              mode === 'amount'
                ? `${t('amount')} - ${t('amountInfoTitle')}`
                : t('amount')
            }
            onMouseEnter={() => mode === 'amount' && setShowInfo(true)}
            onMouseLeave={() => mode === 'amount' && setShowInfo(false)}
            onFocus={() => mode === 'amount' && setShowInfo(true)}
            onBlur={() => setShowInfo(false)}
          >
            <span>{t('amount')}</span>
            {mode === 'amount' && (
              <>
                <InfoIcon className="h-4 w-4" />
                <span className="sr-only">{t('amountInfoBody')}</span>
              </>
            )}
          </button>
          {mode === 'amount' && (
            <div
              className={cn(
                'absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg',
                !showInfo && 'hidden'
              )}
              role="tooltip"
            >
              <div className="font-semibold mb-1">{t('amountInfoTitle')}</div>
              <p className="text-[11px] leading-snug">{t('amountInfoBody')}</p>
              <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

