'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface SaveChangesModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: 'editCurrent' | 'createNew') => void;
}

export function SaveChangesModeModal({
  isOpen,
  onClose,
  onSelect,
}: SaveChangesModeModalProps) {
  const t = useTranslations('savePortfolio');
  const tCommon = useTranslations('common');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('saveChangesModeTitle')}
      showCloseButton
      maxWidth="sm"
    >
      <div className="space-y-5">
        <p className="text-sm text-slate-600 leading-relaxed">
          {t('saveChangesModeDescription')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full justify-center text-sm text-center"
            onClick={() => onSelect('editCurrent')}
          >
            {t('saveChangesEditCurrentLabel')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full justify-center text-sm text-center"
            onClick={() => onSelect('createNew')}
          >
            {t('saveChangesCreateNewLabel')}
          </Button>
        </div>
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={onClose}
          >
            {tCommon('cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

