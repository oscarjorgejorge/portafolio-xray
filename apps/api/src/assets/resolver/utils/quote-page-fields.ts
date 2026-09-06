import { IdentifierClassifier } from '../../../common/utils/identifier-classifier';
import { MS_ASSET_TYPES, MorningstarAssetType } from './constants';
import { isValidIsin } from './id-extractor';

/**
 * Words that appear in ETF/fund titles and type badges but are not tickers.
 * "ETF" in "UCITS ETF 1C XSFD" was previously stored as the stock ticker.
 */
const TICKER_STOPWORDS = new Set([
  'ACC',
  'AND',
  'CLASS',
  'COTIZACION',
  'ETC',
  'ETCS',
  'ETF',
  'ETFS',
  'EUR',
  'FOR',
  'FROM',
  'FUND',
  'FUNDS',
  'GBP',
  'INC',
  'INDEX',
  'ISIN',
  'JPY',
  'LTD',
  'NAV',
  'PLC',
  'PRICE',
  'QUOTE',
  'SHARE',
  'SHARES',
  'STOCK',
  'STOCKS',
  'SWAP',
  'THE',
  'UCITS',
  'USD',
  'WITH',
]);

const HEADER_TYPE_ISIN_PATTERN =
  /\b(ETF|ETC|FUND|FONDO|STOCK|STOCKS|ACCION|ACCIONES|ACCIÓN)\s+([A-Z]{2}[A-Z0-9]{10})\b/i;

export interface QuoteHeaderIdentity {
  assetType: MorningstarAssetType;
  isin: string;
}

export interface QuoteTickerSources {
  url?: string;
  pageTitle?: string;
  metaKeywords?: string;
  pageText?: string;
}

/**
 * True when the value looks like an exchange ticker, not a type badge or 0P ID.
 */
export function isPlausibleTicker(
  value: string | null | undefined,
): value is string {
  if (!value) {
    return false;
  }

  const ticker = value.trim().toUpperCase();
  if (!/^[A-Z0-9.]{1,10}$/.test(ticker)) {
    return false;
  }
  if (TICKER_STOPWORDS.has(ticker)) {
    return false;
  }
  if (/^0P000/i.test(ticker) || /^F000/i.test(ticker)) {
    return false;
  }

  return true;
}

/**
 * Visible Morningstar quote header: "ETF LU0328476410 USD".
 */
export function parseQuoteHeaderIdentity(
  pageText: string,
): QuoteHeaderIdentity | null {
  if (!pageText) {
    return null;
  }

  const match = pageText.match(HEADER_TYPE_ISIN_PATTERN);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const isin = match[2].toUpperCase();
  if (!isValidIsin(isin) || !IdentifierClassifier.validateISINChecksum(isin)) {
    return null;
  }

  return {
    assetType: mapHeaderType(match[1]),
    isin,
  };
}

/**
 * Ticker from quote URL / title / labels, skipping type words like ETF.
 */
export function extractTickerFromQuotePage(
  sources: QuoteTickerSources,
): string | undefined {
  const url = sources.url ?? '';

  const pathMatch = url.match(
    /\/(?:stocks|etfs|funds|acciones|fondos)\/[a-z0-9]+\/([a-z0-9.-]+)(?:\/|$)/i,
  );
  if (pathMatch?.[1] && isPlausibleTicker(pathMatch[1])) {
    return pathMatch[1].toUpperCase();
  }

  const urlParamMatch = url.match(/[?&]ticker=([A-Z0-9.]{1,10})/i);
  if (urlParamMatch?.[1] && isPlausibleTicker(urlParamMatch[1])) {
    return urlParamMatch[1].toUpperCase();
  }

  const metaKeywords = sources.metaKeywords ?? '';
  if (metaKeywords) {
    const keywordsMatch = metaKeywords.match(/^([A-Z]{1,5})(?:,|\s)/);
    if (keywordsMatch?.[1] && isPlausibleTicker(keywordsMatch[1])) {
      return keywordsMatch[1].toUpperCase();
    }
  }

  const pageTitle = sources.pageTitle ?? '';
  const titleStartMatch = pageTitle.match(
    /^([A-Z]{1,5})\s+(?:Precio|Price|Quote)/i,
  );
  if (titleStartMatch?.[1] && isPlausibleTicker(titleStartMatch[1])) {
    return titleStartMatch[1].toUpperCase();
  }

  const titleTokens = [...pageTitle.matchAll(/\b([A-Z]{1,5})\b/g)].map(
    (token) => token[1],
  );
  for (let i = titleTokens.length - 1; i >= 0; i -= 1) {
    if (isPlausibleTicker(titleTokens[i])) {
      return titleTokens[i].toUpperCase();
    }
  }

  const pageText = sources.pageText ?? '';
  const textTickerMatch = pageText.match(
    /(?:Ticker|Symbol)[:\s]*([A-Z0-9.]{1,10})/i,
  );
  if (textTickerMatch?.[1] && isPlausibleTicker(textTickerMatch[1])) {
    return textTickerMatch[1].toUpperCase();
  }

  return undefined;
}

/**
 * A quote page is usable when it has an ISIN, or a name plus a real type.
 * ETF/fund pages must not fall through to STOCK just because ISIN is missing
 * from SSR HTML.
 */
export function isQuoteVerificationValid(options: {
  marketNotAvailable?: boolean;
  isinFound?: string | null;
  nameFound?: string | null;
  detectedAssetType?: string;
  triedAssetType?: string;
}): boolean {
  if (options.marketNotAvailable) {
    return false;
  }
  if (options.isinFound) {
    return true;
  }

  const detected = options.detectedAssetType;
  const effectiveType = detected || options.triedAssetType;
  const isFundLike =
    effectiveType === MS_ASSET_TYPES.ETF ||
    effectiveType === MS_ASSET_TYPES.FUND;
  const isStock =
    effectiveType === MS_ASSET_TYPES.STOCK &&
    detected !== MS_ASSET_TYPES.ETF &&
    detected !== MS_ASSET_TYPES.FUND;

  if (isStock || isFundLike) {
    return Boolean(options.nameFound);
  }

  return false;
}

function mapHeaderType(rawType: string): MorningstarAssetType {
  const normalized = rawType
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (normalized === 'ETF' || normalized === 'ETC') {
    return MS_ASSET_TYPES.ETF;
  }
  if (
    normalized === 'STOCK' ||
    normalized === 'STOCKS' ||
    normalized === 'ACCION' ||
    normalized === 'ACCIONES'
  ) {
    return MS_ASSET_TYPES.STOCK;
  }
  return MS_ASSET_TYPES.FUND;
}
