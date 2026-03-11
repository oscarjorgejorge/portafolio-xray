'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useMutation } from '@tanstack/react-query';
import { resolveAsset } from '@/lib/api/assets';
import { useDuplicateCheck } from '@/lib/hooks/useDuplicateCheck';
import type { PortfolioAsset, AssetType } from '@/types';
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
  const t = useTranslations('assetInput');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { checkDuplicate } = useDuplicateCheck(existingAssets);

  const resolveMutation = useMutation({
    mutationFn: (identifier: string) =>
      resolveAsset(identifier, assetTypeHint),
    onSuccess: (data) => {
      const trimmedIdentifier = input.trim().toUpperCase();

      if (data.success && data.asset) {
        // Check for duplicate before adding
        if (checkDuplicate(trimmedIdentifier, data.asset)) {
          setError(t('duplicateError'));
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
          setError(t('duplicateError'));
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
          setError(t('duplicateError'));
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
      setError(t('emptyError'));
      return;
    }

    // Check for duplicate by identifier before making API call
    if (checkDuplicate(trimmedInput.toUpperCase())) {
      setError(t('duplicateError'));
      return;
    }

    setError(null);
    resolveMutation.mutate(trimmedInput);
  };

  return (
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
  );
};

