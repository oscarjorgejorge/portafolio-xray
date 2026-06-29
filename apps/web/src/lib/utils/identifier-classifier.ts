/**
 * Client-side identifier classification aligned with the API
 * (@see apps/api/src/common/utils/identifier-classifier.ts)
 */
export enum IdentifierType {
  ISIN = 'ISIN',
  MORNINGSTAR_ID = 'MORNINGSTAR_ID',
  TICKER = 'TICKER',
  FREE_TEXT = 'FREE_TEXT',
}

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{10}$/;
const MS_ID_REGEX = /^(0P[A-Z0-9]{8}|F0[A-Z0-9]{8,10})$/i;
const TICKER_REGEX = /^[A-Z]{1,5}$/;

export function normalizeIdentifierInput(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, ' ');
}

function isISIN(input: string): boolean {
  return ISIN_REGEX.test(input.toUpperCase());
}

function isMorningstarId(input: string): boolean {
  return MS_ID_REGEX.test(input.toUpperCase());
}

function isTicker(input: string): boolean {
  return TICKER_REGEX.test(input.toUpperCase());
}

/**
 * Classify user input as ISIN, Morningstar ID, ticker, or free-text (name search).
 */
export function classifyIdentifier(input: string): IdentifierType {
  const normalized = normalizeIdentifierInput(input);

  if (!normalized) {
    return IdentifierType.FREE_TEXT;
  }

  if (isISIN(normalized)) {
    return IdentifierType.ISIN;
  }

  if (isMorningstarId(normalized)) {
    return IdentifierType.MORNINGSTAR_ID;
  }

  if (isTicker(normalized)) {
    return IdentifierType.TICKER;
  }

  return IdentifierType.FREE_TEXT;
}
