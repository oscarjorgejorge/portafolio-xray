'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { AlternativeAsset } from '@/lib/api/assets';
import { confirmAsset, type AssetType } from '@/lib/api/assets';
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
      // Extract ISIN from identifier if it's an ISIN format
      const isin = identifier.length === 12 ? identifier : '';
      
      // Try to determine asset type from name (simple heuristic)
      let assetType: AssetType = 'FUND';
      const nameUpper = alt.name.toUpperCase();
      if (nameUpper.includes('ETF')) assetType = 'ETF';
      else if (nameUpper.includes('STOCK') || nameUpper.includes('SHARE')) assetType = 'STOCK';
      
      return confirmAsset({
        isin: isin || identifier,
        morningstarId: alt.morningstarId,
        name: alt.name,
        type: assetType,
        url: alt.url,
      });
    },
    onSuccess: (asset, alt) => {
      onSelected(alt.morningstarId, alt.name, alt.url);
    },
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          Multiple matches found for "{identifier}"
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Please select the correct asset from the list below:
        </p>
        <div className="space-y-2">
          {alternatives.map((alt, index) => (
            <div
              key={alt.morningstarId}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{alt.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Morningstar ID: {alt.morningstarId}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Confidence: {(alt.score * 100).toFixed(1)}%
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
      </Card>
    </div>
  );
};

