import { MS_ASSET_TYPES, MorningstarAssetType } from './constants';
import { detectAssetTypeFromMorningstarUrl } from './www-morningstar-quote';

export { detectAssetTypeFromMorningstarUrl };

/**
 * URL path segments for different asset types
 */
const PATH_MAP: Record<MorningstarAssetType, { es: string; en: string }> = {
  [MS_ASSET_TYPES.ETF]: { es: 'etfs', en: 'etfs' },
  [MS_ASSET_TYPES.FUND]: { es: 'fondos', en: 'funds' },
  [MS_ASSET_TYPES.STOCK]: { es: 'acciones', en: 'stocks' },
  [MS_ASSET_TYPES.UNKNOWN]: { es: 'fondos', en: 'funds' }, // Default to funds for unknown
};

/**
 * Build Morningstar URL for a given ID
 * @param id - Morningstar ID
 * @param assetType - Asset type (ETF, Fondo, Accion)
 * @param marketId - Optional market ID for multi-market support (e.g., 'lu', 'de', 'it')
 */
export function buildMorningstarUrl(
  id: string,
  assetType: MorningstarAssetType = MS_ASSET_TYPES.FUND,
  marketId?: string,
): string {
  const paths = PATH_MAP[assetType] || PATH_MAP[MS_ASSET_TYPES.FUND];

  // If marketId is provided, use the en-eu format with marketID parameter
  if (marketId === 'eu') {
    return `https://global.morningstar.com/en-eu/investments/${paths.en}/${id}/quote`;
  }
  if (marketId) {
    return `https://global.morningstar.com/en-eu/investments/${paths.en}/${id}/quote?marketID=${marketId}`;
  }

  // Default: Spanish market
  return `https://global.morningstar.com/es/inversiones/${paths.es}/${id}/cotizacion`;
}

/**
 * Quote URL in original path casing. Chart pages and uppercased pasted
 * URLs are rewritten to /quote or /cotizacion so verification can run.
 */
export function canonicalMorningstarQuoteUrl(
  pastedInput: string,
  morningstarId: string,
): string {
  const lower = pastedInput.toLowerCase();
  const assetType = detectAssetTypeFromMorningstarUrl(pastedInput);

  const localeMatch = lower.match(
    /global\.morningstar\.com\/(en-[a-z]{2}|es|fr|de|it)\//,
  );
  const locale = localeMatch?.[1];
  if (locale && locale !== 'es') {
    const path =
      assetType === MS_ASSET_TYPES.ETF
        ? 'etfs'
        : assetType === MS_ASSET_TYPES.STOCK
          ? 'stocks'
          : 'funds';
    return `https://global.morningstar.com/${locale}/investments/${path}/${morningstarId}/quote`;
  }

  return buildMorningstarUrl(morningstarId, assetType);
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
 * Default market is Spain; Irish/UCITS ISINs often only appear with another country.
 */
export function buildGlobalSearchUrl(
  query: string,
  options?: { languageId?: string; countryId?: string },
): string {
  const languageId = options?.languageId ?? 'es-ES';
  const countryId = options?.countryId ?? 'ES';
  return `https://global.morningstar.com/api/v1/security/search?q=${encodeURIComponent(query)}&languageId=${encodeURIComponent(languageId)}&countryId=${encodeURIComponent(countryId)}`;
}

/**
 * Build DuckDuckGo search URL
 */
export function buildDuckDuckGoUrl(searchQuery: string): string {
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
}

/**
 * Yahoo Finance search — used when Morningstar search APIs are bot-challenged.
 * Fund listings often expose the performance ID as a symbol like 0P0001CLDK.F
 */
export function buildYahooFinanceSearchUrl(query: string): string {
  return `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`;
}

/**
 * www.morningstar.com quote page. Global.morningstar.com is often WAF-blocked
 * from the API; this path still returns ISIN and share-class IDs.
 */
export function buildWwwMorningstarQuoteUrl(
  id: string,
  assetType: MorningstarAssetType = MS_ASSET_TYPES.FUND,
): string {
  const path =
    assetType === MS_ASSET_TYPES.ETF
      ? 'etfs'
      : assetType === MS_ASSET_TYPES.STOCK
        ? 'stocks'
        : 'funds';
  return `https://www.morningstar.com/${path}/_/${id}/quote`;
}

/**
 * Quote pages to try when looking up an Instant X-Ray F ID.
 * www.morningstar.com first — global.morningstar.com is often WAF-blocked.
 */
export function shareClassIdLookupUrls(
  morningstarId: string,
  storedUrl?: string | null,
  assetType: MorningstarAssetType = MS_ASSET_TYPES.FUND,
): string[] {
  const urls = [buildWwwMorningstarQuoteUrl(morningstarId, assetType)];
  if (storedUrl) {
    urls.push(storedUrl);
  }
  return [...new Set(urls)];
}
