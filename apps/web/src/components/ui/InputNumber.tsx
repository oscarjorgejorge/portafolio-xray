'use client';

import React, { forwardRef, useId, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface InputNumberProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'size'> {
  /** Label text displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Minimum allowed value (default: 0) */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Step increment for arrow buttons (default: 0.01) */
  step?: number;
  /** Callback when value changes with validated number */
  onChange?: (value: number) => void;
  /** Whether to allow negative values (default: false) */
  allowNegative?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Suffix text (e.g., '%', '$') */
  suffix?: string;
}

/**
 * Numeric input component with built-in validation.
 * Ensures values stay within min/max bounds and handles edge cases.
 */
export const InputNumber = forwardRef<HTMLInputElement, InputNumberProps>(
  (
    {
      label,
      error,
      min = 0,
      max,
      step = 0.01,
      onChange,
      allowNegative = false,
      size = 'md',
      suffix,
      className,
      id,
      value,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;

        // Allow empty input (will be treated as 0)
        if (rawValue === '' || rawValue === '-') {
          onChange?.(0);
          return;
        }

        let numValue = parseFloat(rawValue);

        // If not a valid number, ignore
        if (isNaN(numValue)) {
          return;
        }

        // Enforce minimum bound
        if (!allowNegative && numValue < 0) {
          numValue = 0;
        }
        if (min !== undefined && numValue < min) {
          numValue = min;
        }

        // Enforce maximum bound
        if (max !== undefined && numValue > max) {
          numValue = max;
        }

        onChange?.(numValue);
      },
      [onChange, min, max, allowNegative]
    );

    const sizeClasses = {
      sm: 'px-2 py-1.5 text-sm',
      md: 'px-3 py-2',
    };

    return (
      <div className={cn('w-full', size === 'sm' && 'w-24')}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type="number"
            inputMode="decimal"
            value={value ?? ''}
            onChange={handleChange}
            min={allowNegative ? undefined : min}
            max={max}
            step={step}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              'w-full border rounded-lg text-foreground bg-card',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
              'disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-75',
              error ? 'border-red-500' : 'border-border',
              sizeClasses[size],
              suffix && 'pr-8',
              className
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1 text-xs text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

InputNumber.displayName = 'InputNumber';
