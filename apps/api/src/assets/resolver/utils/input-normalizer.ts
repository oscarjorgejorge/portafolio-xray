import { InputType } from '../resolver.types';

/**
 * Normalize input string for consistent processing
 */
export function normalizeInput(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Classify the input type based on its format
 */
export function classifyInput(input: string): InputType {
  const normalized = normalizeInput(input);

  // ISIN format: 2 letters + 10 alphanumeric characters
  if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(normalized)) {
    return 'ISIN';
  }

  // Morningstar ID format: starts with 0P000, F000, or F00000
  if (/^(0P000|F000|F00000)[A-Z0-9]+$/i.test(normalized)) {
    return 'MORNINGSTAR_ID';
  }

  // Ticker format: 1-5 uppercase letters
  if (/^[A-Z]{1,5}$/.test(normalized)) {
    return 'TICKER';
  }

  // Default to free text
  return 'FREE_TEXT';
}
