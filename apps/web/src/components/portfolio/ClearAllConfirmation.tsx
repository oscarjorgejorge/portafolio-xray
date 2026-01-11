'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <h3 className="text-lg font-semibold mb-4 text-slate-900">
          Clear All Assets
        </h3>
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
      </Card>
    </div>
  );
};

