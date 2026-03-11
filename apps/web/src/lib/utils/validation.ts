/**
 * Validation utilities for the web application.
 */

/** Email: local part @ domain with at least one dot in domain */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks if a string is a valid email format (includes @ and domain).
 * Use with translated error messages from validation.emailInvalid for UI.
 */
export function isValidEmail(value: string): boolean {
  return value.length > 0 && EMAIL_REGEX.test(value.trim());
}

/** ISIN validation: 2 uppercase letters + 10 alphanumeric characters */
const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{10}$/;

/**
 * Validates an ISIN (International Securities Identification Number).
 * ISIN format: 2 letter country code + 10 alphanumeric characters
 *
 * @param value - The ISIN value to validate
 * @returns Error message string if invalid, null if valid
 *
 * @example
 * validateIsin('IE00B4L5Y983') // returns null (valid)
 * validateIsin('123456789012') // returns error (numbers at start)
 * validateIsin('IE00B4L5Y98')  // returns error (too short)
 */
export function validateIsin(value: string): string | null {
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
}

/**
 * Normalizes an ISIN string (trims and uppercases).
 *
 * @param value - The ISIN value to normalize
 * @returns Normalized ISIN string
 */
export function normalizeIsin(value: string): string {
  return value.trim().toUpperCase();
}

/** Ticker validation: 1-10 uppercase alphanumeric characters and dots */
const TICKER_REGEX = /^[A-Z0-9.]+$/;

/**
 * Validates a stock ticker symbol.
 * Ticker format: 1-10 uppercase letters, numbers, and dots (e.g., AAPL, BRK.B)
 *
 * @param value - The ticker value to validate
 * @returns Error message string if invalid, null if valid
 *
 * @example
 * validateTicker('AAPL')   // returns null (valid)
 * validateTicker('BRK.B')  // returns null (valid)
 * validateTicker('')       // returns error (empty)
 * validateTicker('toolong123') // returns error (too long)
 */
export function validateTicker(value: string): string | null {
  const normalized = value.trim().toUpperCase();

  if (!normalized) {
    return 'Ticker is required';
  }

  if (normalized.length > 10) {
    return 'Ticker must be at most 10 characters';
  }

  if (!TICKER_REGEX.test(normalized)) {
    return 'Invalid ticker format (e.g., AAPL, BRK.B)';
  }

  return null;
}

/**
 * Normalizes a ticker string (trims and uppercases).
 *
 * @param value - The ticker value to normalize
 * @returns Normalized ticker string
 */
export function normalizeTicker(value: string): string {
  return value.trim().toUpperCase();
}
