import { ResolverConfig } from '../resolver.types';

/**
 * Morningstar asset type constants
 * Used throughout the resolver for consistent asset type references
 */
export const MS_ASSET_TYPES = {
  FUND: 'Fondo',
  ETF: 'ETF',
  STOCK: 'Accion',
  UNKNOWN: 'Desconocido',
} as const;

/**
 * Type alias for Morningstar asset type values
 */
export type MorningstarAssetType =
  (typeof MS_ASSET_TYPES)[keyof typeof MS_ASSET_TYPES];

/**
 * Default resolver configuration
 */
export const DEFAULT_RESOLVER_CONFIG: ResolverConfig = {
  searchDelay: 500,
  maxResults: 10,
  minConfidence: 0.7,
  domains: ['morningstar.com', 'morningstar.es', 'global.morningstar.com'],
};

/**
 * Scoring weights for result matching
 * Higher values indicate higher priority/confidence
 */
export const SCORE_WEIGHTS = {
  /** Exact Morningstar ID match (highest priority) */
  MORNINGSTAR_ID_EXACT_MATCH: 100,
  /** ISIN found in result text */
  ISIN_MATCH: 50,
  /** Ticker symbol matches exactly */
  TICKER_MATCH: 40,
  /** Maximum score for partial name match (scaled by match percentage) */
  NAME_MATCH_MAX: 30,
  /** Result from a Morningstar domain */
  MORNINGSTAR_DOMAIN: 20,
  /** Result has a valid Morningstar ID */
  HAS_MORNINGSTAR_ID: 10,
  /** Bonus for fund IDs starting with "F" (preferred format) */
  FUND_F_ID_BONUS: 15,
  /** Bonus when page verification confirms ISIN */
  VERIFICATION_BONUS: 50,
} as const;

/**
 * Maximum possible scores for confidence calculation per input type
 * Used to normalize scores to 0-1 confidence range
 */
export const MAX_SCORES = {
  /** When page is verified or input is Morningstar ID */
  VERIFIED: 130,
  /** When input is a Morningstar ID */
  MORNINGSTAR_ID: 130,
  /** When input is a ticker symbol */
  TICKER: 70,
  /** When input is free text or ISIN */
  DEFAULT: 80,
} as const;

/**
 * Minimum word length to consider for name matching
 */
export const MIN_WORD_LENGTH_FOR_MATCHING = 3;

/**
 * European markets to try when a fund is not available in the default market (ES)
 * Ordered by likelihood of fund availability (Luxembourg is most common for UCITS funds)
 */
export const EUROPEAN_MARKETS = [
  'lu',
  'de',
  'it',
  'ch',
  'gb',
  'fr',
  'nl',
  'at',
  'be',
] as const;

/**
 * Morningstar type mapping from API codes to asset types
 */
export const MORNINGSTAR_TYPE_MAP: Record<string, MorningstarAssetType> = {
  FO: MS_ASSET_TYPES.FUND,
  FE: MS_ASSET_TYPES.FUND,
  FC: MS_ASSET_TYPES.FUND,
  CE: MS_ASSET_TYPES.ETF,
  ET: MS_ASSET_TYPES.ETF,
  ST: MS_ASSET_TYPES.STOCK,
  EQ: MS_ASSET_TYPES.STOCK,
  IX: MS_ASSET_TYPES.FUND,
};

/**
 * Valid ISIN country code prefixes (excludes Morningstar ID prefixes like F0, 0P)
 */
export const VALID_ISIN_PREFIXES = [
  'LU',
  'IE',
  'DE',
  'FR',
  'GB',
  'NL',
  'CH',
  'AT',
  'ES',
  'IT',
  'BE',
  'SE',
  'NO',
  'DK',
  'FI',
  'PT',
  'US',
  'CA',
  'JP',
  'AU',
  'HK',
  'SG',
] as const;

// Note: HTTP headers are now managed by HttpClientService in common/http/
// See http-client.service.ts for default headers configuration
