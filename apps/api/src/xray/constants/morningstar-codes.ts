import { AssetType } from '@prisma/client';

/**
 * Site locale to Instant X-Ray LanguageId.
 * en-GB is the English report that Morningstar actually renders for this client.
 */
export const REPORT_LANGUAGE_IDS = {
  es: 'es-ES',
  en: 'en-GB',
} as const;

export type ReportLanguage = keyof typeof REPORT_LANGUAGE_IDS;

export function resolveReportLanguageId(language?: string): string {
  if (language === 'en') {
    return REPORT_LANGUAGE_IDS.en;
  }
  return REPORT_LANGUAGE_IDS.es;
}

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

/**
 * SecurityTokenList pieces for the Renta 4 X-Ray PDF.
 * Funds use type 2 and FOESP. Stocks use type 3 and E0WWE.
 * The short typeid ST does not resolve equities on that endpoint.
 */
export const MORNINGSTAR_SECURITY_TOKEN = {
  FUND_TYPE: '2',
  STOCK_TYPE: '3',
  FUND_EXCHANGE: 'FOESP',
  STOCK_EXCHANGE: 'E0WWE',
  SUFFIX: '$$ALL_1340',
  PORTFOLIO_TYPE: '2',
} as const;
