'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ClearAllConfirmationProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const ClearAllConfirmation: React.FC<ClearAllConfirmationProps> = ({
  onConfirm,
  onCancel,
}) => {
  const t = useTranslations('clearConfirm');
  const tCommon = useTranslations('common');
  
  return (
    <Modal isOpen onClose={onCancel} title={t('title')}>
      <p className="text-sm text-slate-700 mb-6">
        {t('message')}
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {t('confirm')}
        </Button>
      </div>
    </Modal>
  );
};

