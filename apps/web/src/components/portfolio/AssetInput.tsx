'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useMutation } from '@tanstack/react-query';
import { resolveAsset, type AssetType } from '@/lib/api/assets';
import type { PortfolioAsset } from '@/types';
import { generateSimpleId } from '@/lib/utils/id';

interface AssetInputProps {
  onAssetResolved: (asset: PortfolioAsset) => void;
  assetTypeHint?: AssetType;
  existingAssets?: PortfolioAsset[];
}

export const AssetInput: React.FC<AssetInputProps> = ({
  onAssetResolved,
  assetTypeHint,
  existingAssets = [],
}) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const checkDuplicate = (
    identifier: string,
    resolvedAsset?: { isin?: string | null; morningstarId?: string }
  ): boolean => {
    return existingAssets.some((existingAsset) => {
      // Check by identifier (ISIN, ticker, etc.)
      if (
        existingAsset.identifier.toUpperCase() === identifier.toUpperCase()
      ) {
        return true;
      }
      // Check by ISIN if both have resolved assets
      if (
        existingAsset.asset?.isin &&
        resolvedAsset?.isin &&
        existingAsset.asset.isin.toUpperCase() ===
          resolvedAsset.isin.toUpperCase()
      ) {
        return true;
      }
      // Check by Morningstar ID if both have resolved assets
      if (
        existingAsset.asset?.morningstarId &&
        resolvedAsset?.morningstarId &&
        existingAsset.asset.morningstarId === resolvedAsset.morningstarId
      ) {
        return true;
      }
      return false;
    });
  };

  const resolveMutation = useMutation({
    mutationFn: (identifier: string) =>
      resolveAsset(identifier, assetTypeHint),
    onSuccess: (data) => {
      const trimmedIdentifier = input.trim().toUpperCase();

      if (data.success && data.asset) {
        // Check for duplicate before adding
        if (checkDuplicate(trimmedIdentifier, data.asset)) {
          setError('This asset is already in your portfolio');
          return;
        }

        // Asset resolved successfully
        const portfolioAsset: PortfolioAsset = {
          id: generateSimpleId(),
          identifier: trimmedIdentifier,
          asset: data.asset,
          weight: 0,
          status: 'resolved',
          isinPending: data.isinPending || data.asset.isinPending || false,
        };
        onAssetResolved(portfolioAsset);
        setInput('');
        setError(null);
      } else if (data.alternatives && data.alternatives.length > 0) {
        // Check for duplicate by identifier before adding
        if (checkDuplicate(trimmedIdentifier)) {
          setError('This asset is already in your portfolio');
          return;
        }

        // Low confidence - show alternatives
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
        // Check for duplicate by identifier before adding
        if (checkDuplicate(trimmedIdentifier)) {
          setError('This asset is already in your portfolio');
          return;
        }

        // Manual input required
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
      setError('Please enter an ISIN, Morningstar ID, or ticker');
      return;
    }

    // Check for duplicate by identifier before making API call
    if (checkDuplicate(trimmedInput.toUpperCase())) {
      setError('This asset is already in your portfolio');
      return;
    }

    setError(null);
    resolveMutation.mutate(trimmedInput);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1">
        <Input
          placeholder="Enter ISIN, Morningstar ID, or ticker (e.g., IE00B4L5Y983)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          error={error || undefined}
          disabled={resolveMutation.isPending}
        />
      </div>
      <Button
        type="submit"
        isLoading={resolveMutation.isPending}
        disabled={!input.trim() || resolveMutation.isPending}
      >
        Add Asset
      </Button>
    </form>
  );
};

