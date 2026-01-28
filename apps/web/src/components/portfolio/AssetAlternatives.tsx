'use client';

import React from 'react';
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
  const confirmMutation = useMutation({
    mutationFn: async (alt: AlternativeAsset) => {
      // Only include ISIN if identifier is valid ISIN format (12 chars)
      const isin = identifier.length === 12 ? identifier : undefined;

      // Try to determine asset type from name (simple heuristic)
      let assetType: AssetType = 'FUND';
      const nameUpper = alt.name.toUpperCase();
      if (nameUpper.includes('ETF')) assetType = 'ETF';
      else if (nameUpper.includes('STOCK') || nameUpper.includes('SHARE')) assetType = 'STOCK';

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
      onSelected(alt.morningstarId, alt.name, alt.url);
    },
  });

  const isSingleAlternative = alternatives.length === 1;
  const title = isSingleAlternative
    ? `Match found for "${identifier}"`
    : `Multiple matches found for "${identifier}"`;

  return (
    <Modal isOpen onClose={onCancel} title={title} maxWidth="2xl">
      <p className="text-sm text-slate-700 mb-4">
        {isSingleAlternative
          ? 'Please confirm this is the correct asset:'
          : 'Please select the correct asset from the list below:'}
      </p>
      <div className="space-y-2">
        {alternatives.map((alt) => (
          <div
            key={alt.morningstarId}
            className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors bg-white"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">{alt.name}</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Morningstar ID: {alt.morningstarId}
                </p>
              </div>
              <Button
                onClick={() => confirmMutation.mutate(alt)}
                isLoading={confirmMutation.isPending}
                size="sm"
                className="ml-4"
              >
                Select
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
};

