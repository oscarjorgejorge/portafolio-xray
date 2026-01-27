'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateAssetIsin } from '@/lib/api/assets';
import { queryKeys } from '@/lib/api/queryKeys';
import type { Asset } from '@/types';
import { EditIcon, CheckIcon, CloseIcon, SpinnerIcon } from '@/components/ui/Icons';

interface EditableIsinProps {
  assetId: string;
  currentIsin: string | null;
  isinManual?: boolean; // True if ISIN was manually entered
  onIsinUpdated: (updatedAsset: Asset) => void;
}

// ISIN validation: 2 uppercase letters + 10 alphanumeric characters
const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{10}$/;

export const EditableIsin: React.FC<EditableIsinProps> = ({
  assetId,
  currentIsin,
  isinManual = false,
  onIsinUpdated,
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
    setInputValue(currentIsin || '');
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInputValue('');
    setError(null);
  };

  const validateIsin = (value: string): string | null => {
    const normalized = value.trim().toUpperCase();
    
    if (!normalized) {
      return 'ISIN is required';
    }
    
    if (normalized.length !== 12) {
      return 'ISIN must be exactly 12 characters';
    }
    
    if (!ISIN_REGEX.test(normalized)) {
      return 'Invalid ISIN format (e.g., LU2485535293)';
    }
    
    return null;
  };

  const handleSave = async () => {
    const normalized = inputValue.trim().toUpperCase();
    const validationError = validateIsin(normalized);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedAsset = await updateAssetIsin(assetId, normalized);
      
      // Invalidate cached asset data to ensure consistency
      await queryClient.invalidateQueries({
        queryKey: queryKeys.assets.byId(assetId),
      });
      
      onIsinUpdated(updatedAsset);
      setIsEditing(false);
      setInputValue('');
    } catch (err) {
      console.error('Failed to update ISIN:', err);
      setError('Failed to save ISIN. Please try again.');
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

  // Display mode: show ISIN or "not available" with edit button
  if (!isEditing) {
    if (currentIsin) {
      return (
        <span className="inline-flex items-center gap-1">
          {currentIsin}
          {isinManual && (
            <span
              className="text-xs text-amber-600 font-medium"
              title="ISIN entered manually"
            >
              (manual)
            </span>
          )}
        </span>
      );
    }

    return (
      <div className="relative inline-flex items-center">
        <span className="text-slate-400 italic">ISIN not available</span>
        <button
          onClick={handleStartEdit}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="ml-1.5 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
          aria-label="Enter ISIN manually"
        >
          <EditIcon />
        </button>
        {showTooltip && (
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
            Enter ISIN manually
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
          placeholder="e.g., LU2485535293"
          maxLength={12}
          disabled={isSaving}
          aria-label="ISIN code"
          aria-invalid={Boolean(error)}
          className={`
            w-32 px-2 py-0.5 text-sm border rounded
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
          aria-label="Save ISIN"
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
