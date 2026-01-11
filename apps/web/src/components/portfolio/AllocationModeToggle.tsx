'use client';

import React from 'react';
import { AllocationMode } from '@/types';

interface AllocationModeToggleProps {
  mode: AllocationMode;
  onChange: (mode: AllocationMode) => void;
}

export const AllocationModeToggle: React.FC<AllocationModeToggleProps> = ({
  mode,
  onChange,
}) => {
  return (
    <div className="flex items-center space-x-4 mb-4">
      <span className="text-sm font-medium text-gray-700">Allocation Mode:</span>
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          type="button"
          onClick={() => onChange('percentage')}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${
              mode === 'percentage'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          Percentage
        </button>
        <button
          type="button"
          onClick={() => onChange('amount')}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${
              mode === 'amount'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          Amount
        </button>
      </div>
    </div>
  );
};

