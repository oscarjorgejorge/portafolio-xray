import { VALID_ISIN_PREFIXES } from './constants';

/**
 * Patterns for extracting Morningstar IDs from URLs
 */
const MORNINGSTAR_ID_PATTERNS = [
  /\/fondos\/([F0][A-Z0-9]{8,12})\//i,
  /\/funds\/([F0][A-Z0-9]{8,12})\//i,
  /\/etfs\/([F0][A-Z0-9]{8,12})\//i,
  /[?&]id=([F0][A-Z0-9]{8,12})/i,
  /(0P000[A-Z0-9]{5,7})/i,
  /(F000[A-Z0-9]{5,8})/i,
  /(F00000[A-Z0-9]{4,6})/i,
];

/**
 * Extract Morningstar ID from a URL
 */
export function extractMorningstarId(url: string): string | null {
  for (const pattern of MORNINGSTAR_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }
  return null;
}

/**
 * Extract domain from a URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Check if a string is a valid ISIN (not a Morningstar ID)
 */
export function isValidIsin(candidate: string): boolean {
  if (!candidate || candidate.length !== 12) return false;
  const prefix = candidate.substring(0, 2).toUpperCase();
  return VALID_ISIN_PREFIXES.includes(
    prefix as (typeof VALID_ISIN_PREFIXES)[number],
  );
}
