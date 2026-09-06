'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { InfoIcon } from '@/components/ui/Icons';
import { useMutation } from '@tanstack/react-query';
import { resolveAsset } from '@/lib/api/assets';
import { useDuplicateCheck } from '@/lib/hooks/useDuplicateCheck';
import {
  IdentifierType,
  classifyIdentifier,
  extractMorningstarIdFromUrl,
} from '@/lib/utils/identifier-classifier';
import { cn } from '@/lib/utils';
import type { PortfolioAsset, AssetType } from '@/types';
import { generateSimpleId } from '@/lib/utils/id';

const EXAMPLE_ISIN = 'IE00B4L5Y983';
const EXAMPLE_MORNINGSTAR_ID = '0P00015LRD';

interface AssetInputProps {
  onAssetResolved: (asset: PortfolioAsset) => void;
  assetTypeHint?: AssetType;
  existingAssets?: PortfolioAsset[];
}

function toPortfolioIdentifier(rawInput: string): string {
  return extractMorningstarIdFromUrl(rawInput) ?? rawInput.trim().toUpperCase();
}

function getHintConfig(
  type: IdentifierType,
): { messageKey: 'hintIsin' | 'hintMorningstarId' | 'hintTicker' | 'hintName'; tone: 'success' | 'warning' } | null {
  switch (type) {
    case IdentifierType.ISIN:
      return { messageKey: 'hintIsin', tone: 'success' };
    case IdentifierType.MORNINGSTAR_ID:
      return { messageKey: 'hintMorningstarId', tone: 'success' };
    case IdentifierType.TICKER:
      return { messageKey: 'hintTicker', tone: 'warning' };
    case IdentifierType.FREE_TEXT:
      return { messageKey: 'hintName', tone: 'warning' };
    default:
      return null;
  }
}

export const AssetInput: React.FC<AssetInputProps> = ({
  onAssetResolved,
  assetTypeHint,
  existingAssets = [],
}) => {
  const t = useTranslations('assetInput');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const { checkDuplicate } = useDuplicateCheck(existingAssets);

  const identifierType = useMemo(() => {
    if (input.trim().length < 2) return null;
    return classifyIdentifier(input);
  }, [input]);

  const hintConfig = identifierType ? getHintConfig(identifierType) : null;

  const resolveMutation = useMutation({
    mutationFn: (identifier: string) =>
      resolveAsset(identifier, assetTypeHint),
    onSuccess: (data) => {
      const trimmedIdentifier = toPortfolioIdentifier(input);

      if (data.success && data.asset) {
        if (checkDuplicate(trimmedIdentifier, data.asset)) {
          setError(t('duplicateError'));
          return;
        }

        const portfolioAsset: PortfolioAsset = {
          id: generateSimpleId(),
          identifier: trimmedIdentifier,
          asset: data.asset,
          weight: 0,
          status: 'resolved',
          isinPending:
            !data.asset.isin &&
            (data.isinPending || data.asset.isinPending || false),
        };
        onAssetResolved(portfolioAsset);
        setInput('');
        setError(null);
      } else if (data.alternatives && data.alternatives.length > 0) {
        if (checkDuplicate(trimmedIdentifier)) {
          setError(t('duplicateError'));
          return;
        }

        const portfolioAsset: PortfolioAsset = {
          id: generateSimpleId(),
          identifier: trimmedIdentifier,
          weight: 0,
          status: 'low_confidence',
          alternatives: data.alternatives,
          error: data.error,
        };
        onAssetResolved(portfolioAsset);
        setInput('');
        setError(null);
      } else {
        if (checkDuplicate(trimmedIdentifier)) {
          setError(t('duplicateError'));
          return;
        }

        const portfolioAsset: PortfolioAsset = {
          id: generateSimpleId(),
          identifier: trimmedIdentifier,
          weight: 0,
          status: 'manual_required',
          error: data.error || 'Asset not found',
        };
        onAssetResolved(portfolioAsset);
        setInput('');
        setError(null);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      setError(t('emptyError'));
      return;
    }

    if (checkDuplicate(toPortfolioIdentifier(trimmedInput))) {
      setError(t('duplicateError'));
      return;
    }

    setError(null);
    resolveMutation.mutate(trimmedInput);
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    setError(null);
  };

  return (
    <div className="space-y-2">
      <form
        onSubmit={handleSubmit}
        className="flex gap-2"
        aria-label="Add asset to portfolio"
        aria-busy={resolveMutation.isPending}
      >
        <div className="flex-1">
          <Input
            placeholder={t('placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            error={error || undefined}
            disabled={resolveMutation.isPending}
            aria-label="Asset identifier input"
            aria-describedby="asset-input-helper asset-input-hint"
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          isLoading={resolveMutation.isPending}
          disabled={!input.trim() || resolveMutation.isPending}
        >
          {t('addAsset')}
        </Button>
      </form>

      <div className="flex items-start justify-between gap-2">
        <p id="asset-input-helper" className="text-xs text-slate-600 leading-snug">
          {t('helperText')}
        </p>
        <div className="relative flex-shrink-0">
          <button
            type="button"
            className="text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label={t('infoTitle')}
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
            onFocus={() => setShowInfo(true)}
            onBlur={() => setShowInfo(false)}
          >
            <InfoIcon className="h-4 w-4" />
          </button>
          <div
            className={cn(
              'absolute right-0 top-full z-10 mt-2 w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg',
              !showInfo && 'hidden',
            )}
            role="tooltip"
          >
            <div className="font-semibold mb-1">{t('infoTitle')}</div>
            <p className="text-[11px] leading-snug">{t('infoBody')}</p>
            <div className="absolute -top-1 right-3 h-2 w-2 rotate-45 bg-slate-900" />
          </div>
        </div>
      </div>

      {hintConfig && (
        <div
          id="asset-input-hint"
          className={cn(
            'flex items-center gap-2 text-xs',
            hintConfig.tone === 'success' ? 'text-green-700' : 'text-amber-700',
          )}
          aria-live="polite"
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full flex-shrink-0',
              hintConfig.tone === 'success' ? 'bg-green-500' : 'bg-amber-500',
            )}
            aria-hidden="true"
          />
          <span>{t(hintConfig.messageKey)}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">{t('examplesLabel')}</span>
        {[EXAMPLE_ISIN, EXAMPLE_MORNINGSTAR_ID].map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => handleExampleClick(example)}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-mono text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
};
