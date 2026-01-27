'use client';

import React, { useState } from 'react';
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
      title={`Manual Asset Entry for "${identifier}"`}
      maxWidth="lg"
    >
      <p className="text-sm text-slate-700 mb-4">
        The asset could not be resolved automatically. Please enter the
        Morningstar details manually.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Morningstar ID"
          value={morningstarId}
          onChange={(e) => setMorningstarId(e.target.value.toUpperCase())}
          placeholder="e.g., 0P0000YXJO"
          required
        />
        <Input
          label="Asset Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., iShares Core MSCI World UCITS ETF"
          required
        />
        <Input
          label="Morningstar URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://global.morningstar.com/..."
          type="url"
          required
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Asset Type
          </label>
          <select
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
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={confirmMutation.isPending}
            disabled={!morningstarId || !name || !url}
          >
            Confirm
          </Button>
        </div>
      </form>
    </Modal>
  );
};

