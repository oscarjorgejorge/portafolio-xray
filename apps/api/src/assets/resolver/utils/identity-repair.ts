import { AssetType } from '@prisma/client';
import {
  extractPreferredFundId,
  isFundShareClassId,
  needsShareClassEnrichment,
  resolveShareClassLookupId,
} from './canonical-fund-id';
import { detectAssetTypeFromMorningstarUrl } from './www-morningstar-quote';
import { MS_ASSET_TYPES } from './constants';

const QUOTE_PATH_PATTERN = /\/(etfs|stocks|acciones|funds|fondos)\//i;

export type IdentityAsset = {
  id: string;
  morningstarId: string;
  shareClassId?: string | null;
  type: AssetType;
  url: string | null;
  name: string;
  isin?: string | null;
};

export type IdentitySkipReason =
  | 'INVALID_ID'
  | 'STOCK'
  | 'NO_LOOKUP_NEEDED'
  | 'HTTP_BLOCKED'
  | 'HTTP_ERROR'
  | 'TIMEOUT'
  | 'NO_F_ID'
  | 'BOT_STOP'
  | 'DUPLICATE';

export type IdentityPlan =
  | { action: 'correct_type'; type: AssetType }
  | { action: 'save_share_class'; shareClassId: string }
  | { action: 'lookup'; morningstarId: string }
  | { action: 'skip'; reason: IdentitySkipReason };

function prismaTypeFromMsType(
  msType: (typeof MS_ASSET_TYPES)[keyof typeof MS_ASSET_TYPES],
): AssetType {
  if (msType === MS_ASSET_TYPES.ETF) return AssetType.ETF;
  if (msType === MS_ASSET_TYPES.STOCK) return AssetType.STOCK;
  return AssetType.FUND;
}

export function typeFromQuoteUrl(
  url: string | null | undefined,
): AssetType | null {
  if (!url || !QUOTE_PATH_PATTERN.test(url)) {
    return null;
  }
  return prismaTypeFromMsType(detectAssetTypeFromMorningstarUrl(url));
}

/**
 * Type implied by the Morningstar quote URL, when it contradicts the cached type.
 * Does not flip ETF → FUND or retag ETCs.
 */
export function correctedType(
  current: AssetType,
  url: string | null | undefined,
): AssetType | null {
  const urlType = typeFromQuoteUrl(url);
  if (!urlType || urlType === current || current === AssetType.ETC) {
    return null;
  }
  if (urlType === AssetType.STOCK) {
    return AssetType.STOCK;
  }
  if (current === AssetType.STOCK) {
    return urlType;
  }
  if (urlType === AssetType.ETF && current === AssetType.FUND) {
    return AssetType.ETF;
  }
  return null;
}

export function localShareClassId(asset: {
  morningstarId: string;
  url?: string | null;
}): string | null {
  return (
    extractPreferredFundId(asset.url ?? '') ??
    extractPreferredFundId(asset.morningstarId)
  );
}

/**
 * Decide how to repair a cached row before hitting Morningstar.
 * Stocks and garbage IDs must not be scraped.
 */
export function planIdentityRepair(asset: IdentityAsset): IdentityPlan {
  const nextType = correctedType(asset.type, asset.url);
  if (nextType) {
    return { action: 'correct_type', type: nextType };
  }

  if (asset.type === AssetType.STOCK) {
    return { action: 'skip', reason: 'STOCK' };
  }

  const fromLocal = localShareClassId(asset);
  if (fromLocal) {
    if (asset.shareClassId === fromLocal) {
      return { action: 'skip', reason: 'NO_LOOKUP_NEEDED' };
    }
    return { action: 'save_share_class', shareClassId: fromLocal };
  }

  if (isFundShareClassId(asset.morningstarId)) {
    return { action: 'skip', reason: 'NO_LOOKUP_NEEDED' };
  }

  const lookupId = resolveShareClassLookupId(asset);
  if (!lookupId) {
    return { action: 'skip', reason: 'INVALID_ID' };
  }

  if (
    !needsShareClassEnrichment({
      type: asset.type,
      morningstarId: lookupId,
      shareClassId: asset.shareClassId,
      url: asset.url,
    })
  ) {
    return { action: 'skip', reason: 'NO_LOOKUP_NEEDED' };
  }

  return { action: 'lookup', morningstarId: lookupId };
}

export function formatSkipSummary(
  skipped: Partial<Record<IdentitySkipReason, number>>,
): string {
  return (Object.entries(skipped) as [IdentitySkipReason, number][])
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(', ');
}

export const planShareClassBackfill = planIdentityRepair;
export type BackfillAsset = IdentityAsset;
export type BackfillPlan = IdentityPlan;
export type BackfillSkipReason = IdentitySkipReason;
