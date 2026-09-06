import { AssetType } from '@prisma/client';
import {
  extractPreferredFundId,
  isFundShareClassId,
  isPersistedMorningstarIdValid,
} from './id-extractor';

const STOCK_LIKE_TYPES = new Set(['STOCK', 'ACCION']);

const FUND_LIKE_TYPES = new Set<string>([
  AssetType.FUND,
  AssetType.ETF,
  AssetType.ETC,
]);

/**
 * Funds, ETFs and ETCs use Instant X-Ray fund tokens (type 2 / FOESP)
 */
export function isFundLikeType(type: string | null | undefined): boolean {
  if (!type) return false;
  return FUND_LIKE_TYPES.has(type.toUpperCase());
}

/**
 * Pick the share-class (F…) row when the same ISIN has multiple cache entries
 */
export function pickPreferredFundAsset<
  T extends { morningstarId: string; shareClassId?: string | null },
>(assets: T[]): T | null {
  if (assets.length === 0) return null;
  const validIds = assets.filter((asset) =>
    isPersistedMorningstarIdValid(asset.morningstarId),
  );
  const pool = validIds.length > 0 ? validIds : assets;
  const shareClass = pool.find(
    (asset) =>
      isFundShareClassId(asset.shareClassId) ||
      isFundShareClassId(asset.morningstarId),
  );
  return shareClass ?? pool[0] ?? null;
}

/**
 * Canonical Instant X-Ray ID from a cached fund-like asset, if already known
 * (dedicated shareClassId, F ID on morningstarId, or F ID embedded in the URL)
 */
export function getCanonicalFundIdFromAsset(asset: {
  morningstarId: string;
  shareClassId?: string | null;
  type: AssetType;
  url: string;
}): string | null {
  if (!isFundLikeType(asset.type)) {
    return null;
  }
  if (isFundShareClassId(asset.shareClassId)) {
    return asset.shareClassId!;
  }
  if (isFundShareClassId(asset.morningstarId)) {
    return asset.morningstarId;
  }
  return extractPreferredFundId(asset.url);
}

/**
 * Instant X-Ray F ID without replacing the quote/performance Morningstar ID
 */
export function resolveShareClassId(
  currentId: string,
  type: string | null | undefined,
  url: string,
  shareClassIdFromPage?: string | null,
): string | null {
  if (!currentId || isStockLikeType(type)) {
    return null;
  }
  if (isFundShareClassId(currentId)) {
    return currentId;
  }
  if (shareClassIdFromPage && isFundShareClassId(shareClassIdFromPage)) {
    return shareClassIdFromPage;
  }
  return extractPreferredFundId(url);
}

/**
 * Prefer the Instant X-Ray F ID when the quote URL or page only has a 0P ID
 */
export function preferShareClassId(
  currentId: string,
  type: string | null | undefined,
  url: string,
  shareClassIdFromPage?: string | null,
): string {
  return (
    resolveShareClassId(currentId, type, url, shareClassIdFromPage) ?? currentId
  );
}

/**
 * True when cached identity fields are ready to reuse without hitting Morningstar
 * Funds/ETFs/ETCs need ISIN + quote ID + share-class F ID. Stocks need ISIN + quote ID.
 */
export function isAssetIdentityComplete(asset: {
  isin?: string | null;
  morningstarId?: string | null;
  shareClassId?: string | null;
  type: string | null | undefined;
}): boolean {
  if (!isPersistedMorningstarIdValid(asset.morningstarId)) {
    return false;
  }
  if (!asset.isin) {
    return false;
  }
  if (!isFundLikeType(asset.type)) {
    return true;
  }
  return isFundShareClassId(asset.shareClassId);
}

function isStockLikeType(type: string | null | undefined): boolean {
  if (!type) return false;
  return STOCK_LIKE_TYPES.has(type.toUpperCase());
}

/**
 * Normalize fund names for similarity checks (accents, punctuation, share-class noise)
 */
export function normalizeFundName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(
      /\b(fi|sicav|fcp|class|clase|acc|inc|eur|usd|gbp|hedged|dist|accumulation)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when two fund names likely refer to the same product
 */
export function namesLookSimilar(left: string, right: string): boolean {
  const normalizedLeft = normalizeFundName(left);
  const normalizedRight = normalizeFundName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return true;
  }

  const leftWords = new Set(
    normalizedLeft.split(' ').filter((word) => word.length > 2),
  );
  const rightWords = new Set(
    normalizedRight.split(' ').filter((word) => word.length > 2),
  );
  if (leftWords.size === 0 || rightWords.size === 0) return false;

  let overlap = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) overlap += 1;
  }
  return overlap / Math.min(leftWords.size, rightWords.size) >= 0.5;
}

export {
  isFundShareClassId,
  isPerformanceId,
  isPersistedMorningstarIdValid,
  extractPreferredFundId,
  extractShareClassIdFromHtml,
  extractMorningstarIdFromUrl,
} from './id-extractor';
