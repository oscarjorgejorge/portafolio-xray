/**
 * Validation utilities for the web application.
 */

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
