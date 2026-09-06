import { VALID_ISIN_PREFIXES } from './constants';
import { safeUrlParse } from './error-handler';

/**
 * Patterns for extracting Morningstar IDs from URLs
 */
const MORNINGSTAR_ID_PATTERNS = [
  /\/fondos\/([F0][A-Z0-9]{8,12})\//i,
  /\/funds\/([F0][A-Z0-9]{8,12})\//i,
  /\/etfs\/([F0][A-Z0-9]{8,12})\//i,
  /\/stocks\/([F0][A-Z0-9]{8,12})\//i,
  /\/acciones\/([F0][A-Z0-9]{8,12})\//i,
  /[?&]id=([F0][A-Z0-9]{8,12})/i,
  /(0P000[A-Z0-9]{5,7})/i,
  /(F000[A-Z0-9]{5,8})/i,
  /(F00000[A-Z0-9]{4,6})/i,
];

/** Fund share-class IDs used by Instant X-Ray (F000…, F0GBR…) */
const FUND_SHARE_CLASS_ID_PATTERN = /\b(F0[A-Z0-9]{8,12})\b/i;

/**
 * Extract Morningstar ID from a URL
 * @param url - URL to extract ID from
 * @returns Morningstar ID or null if not found
 */
export function extractMorningstarId(url: string): string | null {
  if (!url) return null;

  for (const pattern of MORNINGSTAR_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }
  return null;
}

/**
 * Morningstar ID when the user pastes a quote/chart URL instead of an ISIN
 */
export function extractMorningstarIdFromUrl(input: string): string | null {
  if (!input || !/morningstar\.com/i.test(input)) {
    return null;
  }
  return extractMorningstarId(input);
}

/**
 * True when the ID is a fund/ETF share-class ID Instant X-Ray accepts
 */
export function isFundShareClassId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^F0[A-Z0-9]{8,12}$/i.test(id.trim());
}

/**
 * True when the ID is a Morningstar performance ID (0P…)
 */
export function isPerformanceId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^0P000[A-Z0-9]{5,7}$/i.test(id.trim());
}

/**
 * True when the stored value is a real Morningstar quote or share-class ID.
 * Rejects ISINs pasted into morningstar_id (e.g. ES0114498027).
 */
export function isPersistedMorningstarIdValid(
  id: string | null | undefined,
): boolean {
  return isPerformanceId(id) || isFundShareClassId(id);
}

/**
 * Extract a fund share-class ID (F…) from a URL, ignoring 0P path IDs
 */
export function extractPreferredFundId(url: string): string | null {
  if (!url) return null;
  const match = url.match(FUND_SHARE_CLASS_ID_PATTERN);
  return match?.[1] ? match[1].toUpperCase() : null;
}

/**
 * Instant X-Ray share-class ID from a quote page.
 * global.morningstar.com SAL uses security-id="F…"; www.morningstar.com
 * embeds the same ID as a quoted JSON value (byId / securityId).
 */
export function extractShareClassIdFromHtml(html: string): string | null {
  if (!html) return null;

  const fromAttributes = pickMostFrequentId(html, [
    /security-id=["'](F0[A-Z0-9]{8,12})["']/gi,
    /data-security-id=["'](F0[A-Z0-9]{8,12})["']/gi,
  ]);
  if (fromAttributes) {
    return fromAttributes;
  }

  return pickMostFrequentId(html, [
    /"(?:securityId|secId|byId)"\s*:\s*"(F0(?:00|GBR)[A-Z0-9]{5,8})"/gi,
    /["'](F0(?:00|GBR)[A-Z0-9]{5,8})["']/gi,
  ]);
}

function pickMostFrequentId(html: string, patterns: RegExp[]): string | null {
  const counts = new Map<string, number>();
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const id = match[1]?.toUpperCase();
      if (!id || !isFundShareClassId(id)) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Extract domain from a URL
 * Uses safe URL parsing to handle invalid URLs gracefully
 * @param url - URL to extract domain from
 * @returns Domain name or empty string if parsing fails
 */
export function extractDomain(url: string): string {
  if (!url) return '';

  const parsedUrl = safeUrlParse(url);
  if (!parsedUrl) {
    return '';
  }

  return parsedUrl.hostname.replace('www.', '');
}

/**
 * Check if a string is a valid ISIN (not a Morningstar ID)
 * @param candidate - String to validate as ISIN
 * @returns true if valid ISIN format with recognized country prefix
 */
export function isValidIsin(candidate: string): boolean {
  if (!candidate || candidate.length !== 12) return false;
  const prefix = candidate.substring(0, 2).toUpperCase();
  return VALID_ISIN_PREFIXES.includes(
    prefix as (typeof VALID_ISIN_PREFIXES)[number],
  );
}
