import { MorningstarAssetType } from '../resolver.types';

/**
 * URL path segments for different asset types
 */
const PATH_MAP: Record<MorningstarAssetType, { es: string; en: string }> = {
  ETF: { es: 'etfs', en: 'etfs' },
  Fondo: { es: 'fondos', en: 'funds' },
  Accion: { es: 'acciones', en: 'stocks' },
  Desconocido: { es: 'fondos', en: 'funds' }, // Default to funds for unknown
};

/**
 * Build Morningstar URL for a given ID
 * @param id - Morningstar ID
 * @param assetType - Asset type (ETF, Fondo, Accion)
 * @param marketId - Optional market ID for multi-market support (e.g., 'lu', 'de', 'it')
 */
export function buildMorningstarUrl(
  id: string,
  assetType: MorningstarAssetType = 'Fondo',
  marketId?: string,
): string {
  const paths = PATH_MAP[assetType] || PATH_MAP.Fondo;

  // If marketId is provided, use the en-eu format with marketID parameter
  if (marketId) {
    return `https://global.morningstar.com/en-eu/investments/${paths.en}/${id}/quote?marketID=${marketId}`;
  }

  // Default: Spanish market
  return `https://global.morningstar.com/es/inversiones/${paths.es}/${id}/cotizacion`;
}

/**
 * Build Morningstar.es API search URL
 */
export function buildApiSearchUrl(query: string): string {
  return `https://www.morningstar.es/es/util/SecuritySearch.ashx?q=${encodeURIComponent(query)}&limit=10&preferedList=`;
}

/**
 * Build Morningstar.es HTML search URL
 */
export function buildHtmlSearchUrl(query: string): string {
  return `https://www.morningstar.es/es/funds/SecuritySearchResults.aspx?search=${encodeURIComponent(query)}&type=`;
}

/**
 * Build Global Morningstar API search URL
 */
export function buildGlobalSearchUrl(query: string): string {
  return `https://global.morningstar.com/api/v1/security/search?q=${encodeURIComponent(query)}&languageId=es-ES&countryId=ES`;
}

/**
 * Build DuckDuckGo search URL
 */
export function buildDuckDuckGoUrl(searchQuery: string): string {
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
}
