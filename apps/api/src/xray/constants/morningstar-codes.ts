import { AssetType } from '@prisma/client';

/**
 * Morningstar type codes for X-Ray URL generation
 * These codes are used in the SecurityTokenList parameter
 */
export const MORNINGSTAR_TYPE_CODES = {
  /** Funds, ETFs, and ETCs use type code 2 */
  FUND: '2',
  ETF: '2',
  ETC: '2',
  /** Stocks use type code 3 */
  STOCK: '3',
} as const;

/**
 * Morningstar exchange codes for X-Ray URL generation
 * These codes are appended to the security token
 */
export const MORNINGSTAR_EXCHANGE_CODES = {
  /** Default exchange for funds/ETFs (FOESP = Spain) */
  FUND: 'FOESP',
  /** Exchange for stocks */
  STOCK: 'E0WWE',
} as const;

/**
 * Get Morningstar type code for an asset type
 * @param assetType - Asset type from database or default
 * @returns Type code string for Morningstar URL
 */
export function getMorningstarTypeCode(assetType?: AssetType | null): string {
  if (assetType === 'STOCK') {
    return MORNINGSTAR_TYPE_CODES.STOCK;
  }
  // FUND, ETF, ETC all use the same type code
  return MORNINGSTAR_TYPE_CODES.FUND;
}

/**
 * Get Morningstar exchange code for an asset type
 * @param assetType - Asset type from database or default
 * @returns Exchange code string for Morningstar URL
 */
export function getMorningstarExchangeCode(
  assetType?: AssetType | null,
): string {
  if (assetType === 'STOCK') {
    return MORNINGSTAR_EXCHANGE_CODES.STOCK;
  }
  return MORNINGSTAR_EXCHANGE_CODES.FUND;
}
