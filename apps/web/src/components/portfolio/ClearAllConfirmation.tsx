'use client';

import React from 'react';
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
  return (
    <Modal isOpen onClose={onCancel} title="Clear All Assets">
      <p className="text-sm text-slate-700 mb-6">
        Are you sure you want to clear all assets? This action cannot be undone.
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Clear All
        </Button>
      </div>
    </Modal>
  );
};

