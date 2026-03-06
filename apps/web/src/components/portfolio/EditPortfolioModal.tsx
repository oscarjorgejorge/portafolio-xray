'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Switch } from '@/components/ui/Switch';
import { updatePortfolio, type PortfolioListItem, type UpdatePortfolioRequest } from '@/lib/api/portfolios';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';

interface EditPortfolioModalProps {
  isOpen: boolean;
  portfolio: PortfolioListItem;
  onClose: () => void;
}

export function EditPortfolioModal({
  isOpen,
  portfolio,
  onClose,
}: EditPortfolioModalProps) {
  const tPortfolios = useTranslations('portfolios');
  const tSave = useTranslations('savePortfolio');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [name, setName] = useState(portfolio.name);
  const [description, setDescription] = useState(portfolio.description ?? '');
  const [isPublic, setIsPublic] = useState(portfolio.isPublic);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isNameValid = name.trim().length > 0;

  useEffect(() => {
    if (isOpen) {
      setName(portfolio.name);
      setDescription(portfolio.description ?? '');
      setIsPublic(portfolio.isPublic);
      setError('');
    }
  }, [isOpen, portfolio]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      const trimmedName = name.trim();
      if (!trimmedName) {
        setError(tSave('nameRequired'));
        return;
      }

      setIsSubmitting(true);
      try {
        const body: UpdatePortfolioRequest = {
          name: trimmedName,
          description: description.trim() || null,
          isPublic,
        };

        await updatePortfolio(portfolio.id, body);
        await queryClient.invalidateQueries({ queryKey: queryKeys.portfolios.all });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : tSave('saveError'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [name, description, isPublic, portfolio.id, queryClient, tSave, onClose]
  );

  const handleClose = useCallback(() => {
    setError('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={tPortfolios('editModalTitle')}
      showCloseButton
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div>
          <label
            htmlFor="edit-portfolio-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {tSave('nameLabel')} *
          </label>
          <Input
            id="edit-portfolio-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tSave('namePlaceholder')}
            required
            maxLength={200}
            autoFocus
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="edit-portfolio-public"
              className="text-sm font-medium text-gray-700"
            >
              {tSave('isPublicLabel')}
            </label>
            <Switch
              id="edit-portfolio-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              aria-label={tSave('isPublicLabel')}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {tSave('isPublicHint')}
          </p>
        </div>
        <div>
          <label
            htmlFor="edit-portfolio-description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {tSave('descriptionLabel')}
          </label>
          <textarea
            id="edit-portfolio-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tSave('descriptionPlaceholder')}
            rows={6}
            maxLength={2000}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[8rem]"
          />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting || !isNameValid}>
            {isSubmitting ? tCommon('loading') : tCommon('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

