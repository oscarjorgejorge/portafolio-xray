'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { confirmAsset } from '@/lib/api/assets';
import type { AlternativeAsset, Asset, AssetType } from '@/types';
import { useMutation } from '@tanstack/react-query';
import { ASSET_TYPES } from '@/lib/constants';

export interface AssetSelectedPayload {
  morningstarId: string;
  name: string;
  url: string;
  type: AssetType;
  ticker?: string;
  /** Full asset from confirm API; when present, parent should use it so UI shows exact type/ticker from backend */
  confirmedAsset?: Asset;
}

interface AssetAlternativesProps {
  identifier: string;
  alternatives: AlternativeAsset[];
  onSelected: (payload: AssetSelectedPayload) => void;
  onCancel: () => void;
}

/**
 * Extract asset type from Morningstar URL
 * URLs contain: /fondos/ (FUND), /acciones/ (STOCK), /etfs/ (ETF)
 */
function extractTypeFromUrl(url: string): AssetType | undefined {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('/etf') || urlLower.includes('/etfs/')) return 'ETF';
  if (urlLower.includes('/acciones/') || urlLower.includes('/stocks/')) return 'STOCK';
  if (urlLower.includes('/fondos/') || urlLower.includes('/funds/')) return 'FUND';
  return undefined;
}

/**
 * Determine the best asset type from available sources
 * Priority: 1) Backend assetType, 2) URL extraction, 3) Name heuristic, 4) Default FUND
 */
function determineAssetType(alt: AlternativeAsset): AssetType {
  // 1. Use backend-detected type if available
  if (alt.assetType) return alt.assetType;

  // 2. Try to extract from URL
  const urlType = extractTypeFromUrl(alt.url);
  if (urlType) return urlType;

  // 3. Fallback to name heuristic
  const nameUpper = alt.name.toUpperCase();
  if (nameUpper.includes('ETF')) return 'ETF';
  if (nameUpper.includes('STOCK') || nameUpper.includes('SHARE')) return 'STOCK';

  // 4. Default to FUND
  return 'FUND';
}

export const AssetAlternatives: React.FC<AssetAlternativesProps> = ({
  identifier,
  alternatives,
  onSelected,
  onCancel,
}) => {
  const t = useTranslations('alternatives');
  const tCommon = useTranslations('common');
  const tAssetRow = useTranslations('assetRow');

  // Track selected asset type per alternative (for user override)
  const [selectedTypes, setSelectedTypes] = useState<Record<string, AssetType>>(() => {
    const initial: Record<string, AssetType> = {};
    alternatives.forEach((alt) => {
      initial[alt.morningstarId] = determineAssetType(alt);
    });
    return initial;
  });

  const handleTypeChange = (morningstarId: string, type: AssetType) => {
    setSelectedTypes((prev) => ({ ...prev, [morningstarId]: type }));
  };

  const confirmMutation = useMutation({
    mutationFn: async (alt: AlternativeAsset) => {
      const isIsinFormat = /^[A-Z]{2}[A-Z0-9]{10}$/.test(identifier.toUpperCase());
      const isin = isIsinFormat ? identifier.toUpperCase() : undefined;

      const assetType = selectedTypes[alt.morningstarId] || determineAssetType(alt);

      return confirmAsset({
        ...(isin && { isin }),
        morningstarId: alt.morningstarId,
        name: alt.name,
        type: assetType,
        url: alt.url,
        ticker: alt.ticker,
      });
    },
    onSuccess: (asset, alt) => {
      // Use type from API response first so UI never shows FUND when backend returned STOCK
      const typeFromApi = asset?.type;
      const type = typeFromApi ?? selectedTypes[alt.morningstarId] ?? determineAssetType(alt);
      onSelected({
        morningstarId: asset.morningstarId,
        name: asset.name,
        url: asset.url,
        type,
        ticker: asset.ticker ?? alt.ticker,
        confirmedAsset: asset,
      });
    },
    onError: (error) => {
      console.error('Failed to confirm asset:', error);
    },
  });

  const isSingleAlternative = alternatives.length === 1;
  const title = isSingleAlternative
    ? t('singleMatch', { identifier })
    : t('multipleMatches', { identifier });

  return (
    <Modal isOpen onClose={onCancel} title={title} maxWidth="2xl">
      <p className="text-sm text-slate-700 mb-4">
        {isSingleAlternative
          ? t('confirmSingle')
          : t('selectFromList')}
      </p>
      <div className="space-y-2">
        {alternatives.map((alt) => {
          const currentType = selectedTypes[alt.morningstarId] || determineAssetType(alt);

          return (
            <div
              key={alt.morningstarId}
              className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-900">{alt.name}</h4>
                    {alt.market && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {alt.market}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {tAssetRow('morningstarId')} {alt.morningstarId}
                  </p>
                  {alt.ticker && (
                    <p className="text-sm text-slate-500">Ticker: {alt.ticker}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={currentType}
                    onChange={(e) =>
                      handleTypeChange(alt.morningstarId, e.target.value as AssetType)
                    }
                    className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    title="Asset type"
                  >
                    {ASSET_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => confirmMutation.mutate(alt)}
                    isLoading={confirmMutation.isPending}
                    size="sm"
                  >
                    {tCommon('select')}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
      </div>
    </Modal>
  );
};

