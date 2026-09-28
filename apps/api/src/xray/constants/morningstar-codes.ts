import { AssetType } from '@prisma/client';

/**
 * Instant X-Ray short-format typeids (securityIds / marketValues / typeids).
 * FO = funds, ETFs and ETCs; ST = stocks.
 */
export const MORNINGSTAR_TYPE_IDS = {
  FUND: 'FO',
  ETF: 'FO',
  ETC: 'FO',
  STOCK: 'ST',
} as const;

/**
 * Instant X-Ray typeid for the short PDF URL format.
 */
export function getMorningstarTypeId(assetType?: AssetType | null): string {
  if (assetType === 'STOCK') {
    return MORNINGSTAR_TYPE_IDS.STOCK;
  }
  return MORNINGSTAR_TYPE_IDS.FUND;
}
