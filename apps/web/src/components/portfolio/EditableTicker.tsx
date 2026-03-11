'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateAssetTicker } from '@/lib/api/assets';
import { queryKeys } from '@/lib/api/queryKeys';
import { captureException } from '@/lib/services/errorReporting';
import { validateTicker, normalizeTicker } from '@/lib/utils/validation';
import type { Asset } from '@/types';
import { EditIcon, CheckIcon, CloseIcon, SpinnerIcon } from '@/components/ui/Icons';

interface EditableTickerProps {
  assetId: string;
  currentTicker: string | null | undefined;
  tickerManual?: boolean; // True if ticker was manually entered
  onTickerUpdated: (updatedAsset: Asset) => void;
}

export const EditableTicker: React.FC<EditableTickerProps> = ({
  assetId,
  currentTicker,
  tickerManual = false,
  onTickerUpdated,
}) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setInputValue(currentTicker || '');
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInputValue('');
    setError(null);
  };

  const handleSave = async () => {
    const normalized = normalizeTicker(inputValue);
    const validationError = validateTicker(inputValue);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedAsset = await updateAssetTicker(assetId, normalized);
      
      // Invalidate cached asset data to ensure consistency
      await queryClient.invalidateQueries({
        queryKey: queryKeys.assets.byId(assetId),
      });
      
      onTickerUpdated(updatedAsset);
      setIsEditing(false);
      setInputValue('');
    } catch (err) {
      captureException(err instanceof Error ? err : new Error('Failed to update ticker'), {
        tags: { action: 'ticker-update' },
        extra: { assetId },
      });
      setError('Failed to save ticker. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setInputValue(value);
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  // Display mode: show ticker or "not available" with edit button
  if (!isEditing) {
    if (currentTicker) {
      return (
        <span className="inline-flex items-center gap-1">
          <span className="font-medium">Ticker:</span> {currentTicker}
          {tickerManual && (
            <span
              className="text-xs text-amber-600 font-medium"
              title="Ticker entered manually"
            >
              (manual)
            </span>
          )}
        </span>
      );
    }

    return (
      <div className="relative inline-flex items-center">
        <span className="text-slate-400 italic">Ticker not available</span>
        <button
          onClick={handleStartEdit}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="ml-1.5 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          aria-label="Enter ticker manually"
        >
          <EditIcon />
        </button>
        {showTooltip && (
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
            Enter ticker manually
            <div className="absolute top-1/2 -left-1 -translate-y-1/2 h-2 w-2 bg-slate-900 rotate-45" />
          </div>
        )}
      </div>
    );
  }

  // Edit mode: show input with save/cancel buttons
  return (
    <div className="inline-flex flex-col">
      <div className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="e.g., AAPL"
          maxLength={10}
          disabled={isSaving}
          aria-label="Ticker symbol"
          aria-invalid={Boolean(error)}
          className={`
            w-24 px-2 py-0.5 text-sm border rounded
            focus:outline-none focus:ring-1 focus:ring-blue-500
            ${error ? 'border-red-500' : 'border-slate-300'}
            ${isSaving ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-900'}
          `}
        />
        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save"
          aria-label="Save ticker"
        >
          {isSaving ? <SpinnerIcon /> : <CheckIcon />}
        </button>
        {/* Cancel button */}
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Cancel"
          aria-label="Cancel editing"
        >
          <CloseIcon />
        </button>
      </div>
      {/* Error message */}
      {error && (
        <span className="text-xs text-red-600 mt-0.5" role="alert">{error}</span>
      )}
    </div>
  );
};
