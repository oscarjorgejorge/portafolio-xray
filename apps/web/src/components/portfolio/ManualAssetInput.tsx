'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { confirmAsset } from '@/lib/api/assets';
import type { AssetType } from '@/types';
import { useMutation } from '@tanstack/react-query';

interface ManualAssetInputProps {
  identifier: string;
  onConfirmed: (morningstarId: string, name: string, url: string) => void;
  onCancel: () => void;
}

export const ManualAssetInput: React.FC<ManualAssetInputProps> = ({
  identifier,
  onConfirmed,
  onCancel,
}) => {
  const t = useTranslations('manualInput');
  const tCommon = useTranslations('common');
  const [morningstarId, setMorningstarId] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('FUND');

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmAsset({
        isin: identifier.length === 12 ? identifier : identifier,
        morningstarId,
        name,
        type: assetType,
        url,
      }),
    onSuccess: (asset) => {
      onConfirmed(asset.morningstarId, asset.name, asset.url);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!morningstarId || !name || !url) {
      return;
    }
    confirmMutation.mutate();
  };

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={t('title', { identifier })}
      maxWidth="lg"
    >
      <p className="text-sm text-slate-700 mb-4">
        {t('description')}
      </p>
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        aria-busy={confirmMutation.isPending}
      >
        <Input
          label={t('morningstarId')}
          value={morningstarId}
          onChange={(e) => setMorningstarId(e.target.value.toUpperCase())}
          placeholder={t('morningstarIdPlaceholder')}
          required
        />
        <Input
          label={t('assetName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('assetNamePlaceholder')}
          required
        />
        <Input
          label={t('morningstarUrl')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('morningstarUrlPlaceholder')}
          type="url"
          required
        />
        <div>
          <label
            htmlFor="asset-type-select"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            {t('assetType')}
          </label>
          <select
            id="asset-type-select"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as AssetType)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
          >
            <option value="ETF" className="text-slate-900">ETF</option>
            <option value="FUND" className="text-slate-900">Fund</option>
            <option value="STOCK" className="text-slate-900">Stock</option>
            <option value="ETC" className="text-slate-900">ETC</option>
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            isLoading={confirmMutation.isPending}
            disabled={!morningstarId || !name || !url}
          >
            {tCommon('confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

