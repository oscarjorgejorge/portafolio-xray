'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useMutation } from '@tanstack/react-query';
import { resolveAsset, type AssetType } from '@/lib/api/assets';
import type { PortfolioAsset } from '@/types';

interface AssetInputProps {
  onAssetResolved: (asset: PortfolioAsset) => void;
  assetTypeHint?: AssetType;
}

export const AssetInput: React.FC<AssetInputProps> = ({
  onAssetResolved,
  assetTypeHint,
}) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resolveMutation = useMutation({
    mutationFn: (identifier: string) =>
      resolveAsset(identifier, assetTypeHint),
    onSuccess: (data) => {
      if (data.success && data.asset) {
        // Asset resolved successfully
        const portfolioAsset: PortfolioAsset = {
          id: Math.random().toString(36).substr(2, 9),
          identifier: input.trim().toUpperCase(),
          asset: data.asset,
          weight: 0,
          status: 'resolved',
        };
        onAssetResolved(portfolioAsset);
        setInput('');
        setError(null);
      } else if (data.alternatives && data.alternatives.length > 0) {
        // Low confidence - show alternatives
        const portfolioAsset: PortfolioAsset = {
          id: Math.random().toString(36).substr(2, 9),
          identifier: input.trim().toUpperCase(),
          weight: 0,
          status: 'low_confidence',
          alternatives: data.alternatives,
          error: data.error,
        };
        onAssetResolved(portfolioAsset);
        setInput('');
        setError(null);
      } else {
        // Manual input required
        const portfolioAsset: PortfolioAsset = {
          id: Math.random().toString(36).substr(2, 9),
          identifier: input.trim().toUpperCase(),
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

