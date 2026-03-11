'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Switch } from '@/components/ui/Switch';
import { createPortfolio, updatePortfolio, type UpdatePortfolioRequest } from '@/lib/api/portfolios';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';
import type { PortfolioAsset as BuilderPortfolioAsset, AllocationMode } from '@/types';
import { VALIDATION } from '@/lib/constants';

export interface SavePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  assets: BuilderPortfolioAsset[];
  allocationMode: AllocationMode;
  /** Optional portfolio id. When provided and mode is 'editCurrent', the existing portfolio will be updated. */
  portfolioId?: string;
  /** Whether the save should update the current portfolio or create a new one. */
  mode?: 'create' | 'editCurrent' | 'createNew';
  /** Initial values used to prefill the form when editing/duplicating. */
  initialName?: string;
  initialDescription?: string | null;
  initialIsPublic?: boolean;
  /** Notify parent when the public/private state changes */
  onIsPublicChange?: (isPublic: boolean) => void;
}

function buildAssetsPayload(
  assets: BuilderPortfolioAsset[],
  allocationMode: AllocationMode
): { morningstarId: string; weight: number; amount?: number }[] {
  const withResolved = assets.filter((a) => a.asset);
  if (allocationMode === 'amount') {
    const totalAmount = withResolved.reduce((sum, a) => sum + (a.weight || 0), 0);
    return withResolved.map((a) => ({
      morningstarId: a.asset!.morningstarId,
      weight:
        totalAmount > 0
          ? (a.weight / totalAmount) * VALIDATION.PERCENTAGE_TOTAL
          : 0,
      amount: a.weight,
    }));
  }
  return withResolved.map((a) => ({
    morningstarId: a.asset!.morningstarId,
    weight: a.weight,
  }));
}

export function SavePortfolioModal({
  isOpen,
  onClose,
  onSuccess,
  assets,
  allocationMode,
  portfolioId,
  mode = 'create',
  initialName,
  initialDescription,
  initialIsPublic = true,
  onIsPublicChange,
}: SavePortfolioModalProps) {
  const t = useTranslations('savePortfolio');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isNameValid = name.trim().length > 0;

  // Reset form values when the modal is opened with new initial data
  useEffect(() => {
    if (isOpen) {
      setName(initialName ?? '');
      setDescription(initialDescription ?? '');
      setIsPublic(initialIsPublic);
      onIsPublicChange?.(initialIsPublic);
      setError('');
    }
  }, [isOpen, initialName, initialDescription, initialIsPublic, onIsPublicChange]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError(t('nameRequired'));
        return;
      }
      const payload = buildAssetsPayload(assets, allocationMode);
      if (payload.length === 0) {
        setError(t('noAssets'));
        return;
      }
      setIsSubmitting(true);
      try {
        if (mode === 'editCurrent' && portfolioId) {
          const body: UpdatePortfolioRequest = {
            name: trimmedName,
            description: description.trim() || null,
            isPublic,
            assets: payload,
          };
          await updatePortfolio(portfolioId, body);
        } else {
          await createPortfolio({
            name: trimmedName,
            description: description.trim() || undefined,
            isPublic,
            assets: payload,
          });
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.portfolios.all });
        onSuccess?.();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : t('saveError'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      name,
      description,
      isPublic,
      assets,
      allocationMode,
      mode,
      portfolioId,
      t,
      queryClient,
      onSuccess,
      onClose,
    ]
  );

  const handleClose = useCallback(() => {
    setError('');
    onClose();
  }, [onClose]);

  const handleIsPublicChange = useCallback(
    (value: boolean) => {
      setIsPublic(value);
      onIsPublicChange?.(value);
    },
    [onIsPublicChange],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('title')}
      showCloseButton
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error">{error}</Alert>
        )}
        <div>
          <label htmlFor="save-portfolio-name" className="block text-sm font-medium text-gray-700 mb-1">
            {t('nameLabel')} *
          </label>
          <Input
            id="save-portfolio-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            required
            maxLength={200}
            autoFocus
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="save-portfolio-public" className="text-sm font-medium text-gray-700">
              {t('isPublicLabel')}
            </label>
            <Switch
              id="save-portfolio-public"
              checked={isPublic}
              onCheckedChange={handleIsPublicChange}
              aria-label={t('isPublicLabel')}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('isPublicHint')}</p>
        </div>
        <div>
          <label htmlFor="save-portfolio-description" className="block text-sm font-medium text-gray-700 mb-1">
            {t('descriptionLabel')}
          </label>
          <textarea
            id="save-portfolio-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting || !isNameValid}>
            {isSubmitting ? tCommon('loading') : t('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
