'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { confirmAsset } from '@/lib/api/assets';
import type { AlternativeAsset, AssetType } from '@/types';
import { useMutation } from '@tanstack/react-query';

interface AssetAlternativesProps {
  identifier: string;
  alternatives: AlternativeAsset[];
  onSelected: (morningstarId: string, name: string, url: string) => void;
  onCancel: () => void;
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
  
  const confirmMutation = useMutation({
    mutationFn: async (alt: AlternativeAsset) => {
      // Check if identifier is a valid ISIN format (12 characters: 2 letters + 10 alphanumeric)
      // Only use it as ISIN if it matches the format, otherwise send null
      const isIsinFormat = /^[A-Z]{2}[A-Z0-9]{10}$/.test(identifier.toUpperCase());
      const isin = isIsinFormat ? identifier.toUpperCase() : null;
      
      // Try to determine asset type from name (simple heuristic)
      let assetType: AssetType = 'FUND';
      const nameUpper = alt.name.toUpperCase();
      if (nameUpper.includes('ETF')) assetType = 'ETF';
      else if (nameUpper.includes('STOCK') || nameUpper.includes('SHARE')) assetType = 'STOCK';
      
      return confirmAsset({
        isin,
        morningstarId: alt.morningstarId,
        name: alt.name,
        type: assetType,
        url: alt.url,
      });
    },
    onError: (error) => {
      // Log error for debugging - in production you might want to show a toast
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
        {alternatives.map((alt) => (
          <div
            key={alt.morningstarId}
            className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors bg-white"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
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
              </div>
              <Button
                onClick={async () => {
                  try {
                    const asset = await confirmMutation.mutateAsync(alt);
                    // Call onSelected which will close the modal via handleAlternativeSelected
                    onSelected(asset.morningstarId, asset.name, asset.url);
                  } catch (error) {
                    // Error is already handled by onError callback
                    console.error('Failed to confirm asset:', error);
                  }
                }}
                isLoading={confirmMutation.isPending}
                size="sm"
                className="ml-4"
              >
                {tCommon('select')}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
      </div>
    </Modal>
  );
};

