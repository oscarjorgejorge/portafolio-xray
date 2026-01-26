import { MorningstarAssetType, ResolverConfig } from '../resolver.types';

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
  FO: 'Fondo',
  FE: 'Fondo',
  FC: 'Fondo',
  CE: 'ETF',
  ET: 'ETF',
  ST: 'Accion',
  EQ: 'Accion',
  IX: 'Fondo',
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
