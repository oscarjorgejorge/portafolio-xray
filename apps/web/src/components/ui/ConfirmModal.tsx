'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TrashIcon } from '@/components/ui/Icons';

export type ConfirmModalVariant = 'danger' | 'primary' | 'secondary';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: ConfirmModalVariant;
  isLoading?: boolean;
}

/**
 * User-friendly confirmation dialog. Use for destructive or important actions
 * (e.g. delete comment) instead of window.confirm.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const confirmVariant = variant === 'danger' ? 'danger' : variant === 'primary' ? 'primary' : 'secondary';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      closeOnOverlayClick={!isLoading}
      showCloseButton={!isLoading}
    >
      <div className="flex flex-col gap-6">
        <p className="text-slate-600 text-sm leading-relaxed">
          {message}
        </p>
        <div className="flex flex-wrap gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-2"
          >
            {variant === 'danger' && <TrashIcon className="w-4 h-4" />}
            {isLoading ? (
              <span className="animate-pulse opacity-90">{confirmLabel}</span>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
