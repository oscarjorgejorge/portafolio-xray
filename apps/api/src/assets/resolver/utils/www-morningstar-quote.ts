import { MS_ASSET_TYPES, MorningstarAssetType } from './constants';
import {
  extractMorningstarId,
  extractShareClassIdFromHtml,
  isValidIsin,
} from './id-extractor';
import { IdentifierClassifier } from '../../../common/utils/identifier-classifier';

/**
 * Yahoo exchange codes / symbol suffixes -> www.morningstar.com MIC
 */
const YAHOO_EXCHANGE_TO_MIC: Record<string, string> = {
  NMS: 'xnas',
  NASDAQ: 'xnas',
  NCM: 'xnas',
  NGSM: 'xnas',
  NYQ: 'xnys',
  NYSE: 'xnys',
  ASE: 'xase',
  AMEX: 'xase',
  PCX: 'arcx',
  ARCA: 'arcx',
  LSE: 'xlon',
  LON: 'xlon',
  GER: 'xetr',
  FRA: 'xetr',
  XETRA: 'xetr',
  PAR: 'xpar',
  EPA: 'xpar',
  AMS: 'xams',
  AEX: 'xams',
  SWX: 'xswx',
  EBS: 'xswx',
  MIL: 'xmil',
  BIT: 'xmil',
  MCE: 'xmce',
  MAD: 'xmce',
  TOR: 'xtse',
  TSE: 'xtse',
  HK: 'xhkg',
  HKG: 'xhkg',
  ASX: 'xasx',
  STO: 'xsto',
  CPH: 'xcse',
  OSL: 'xosl',
  HEL: 'xhel',
  BRU: 'xbru',
  LIS: 'xlis',
};

const YAHOO_SUFFIX_TO_MIC: Record<string, string> = {
  L: 'xlon',
  DE: 'xetr',
  PA: 'xpar',
  AS: 'xams',
  SW: 'xswx',
  MI: 'xmil',
  MC: 'xmce',
  TO: 'xtse',
  HK: 'xhkg',
  AX: 'xasx',
  ST: 'xsto',
  CO: 'xcse',
  OL: 'xosl',
  HE: 'xhel',
  BR: 'xbru',
  LS: 'xlis',
};

export interface WwwTickerQuoteTarget {
  ticker: string;
  mic: string;
  assetType: MorningstarAssetType;
  url: string;
}

export interface WwwQuoteIdentity {
  morningstarId: string;
  shareClassId?: string;
  isin?: string;
  ticker?: string;
  name?: string;
  assetType: MorningstarAssetType;
  url: string;
}

/**
 * Yahoo suffix (.L) or exchange code -> Morningstar MIC(s) to try
 */
export function morningstarMicsForYahooQuote(
  symbol: string,
  exchange?: string,
): string[] {
  const suffix = symbol.includes('.')
    ? symbol.slice(symbol.lastIndexOf('.') + 1).toUpperCase()
    : '';
  const fromSuffix = suffix ? YAHOO_SUFFIX_TO_MIC[suffix] : undefined;
  const fromExchange = exchange
    ? YAHOO_EXCHANGE_TO_MIC[exchange.toUpperCase()]
    : undefined;

  const mics = [fromSuffix, fromExchange].filter((mic): mic is string =>
    Boolean(mic),
  );
  if (mics.length > 0) {
    return [...new Set(mics)];
  }

  return ['xnas', 'xnys', 'arcx'];
}

export function yahooSymbolToTicker(symbol: string): string {
  const bare = symbol.includes('.')
    ? symbol.slice(0, symbol.lastIndexOf('.'))
    : symbol;
  return bare.trim().toUpperCase();
}

export function buildWwwMorningstarTickerQuoteUrl(
  assetType: MorningstarAssetType,
  mic: string,
  ticker: string,
): string {
  const path =
    assetType === MS_ASSET_TYPES.ETF
      ? 'etfs'
      : assetType === MS_ASSET_TYPES.STOCK
        ? 'stocks'
        : 'funds';
  return `https://www.morningstar.com/${path}/${mic.toLowerCase()}/${ticker.toLowerCase()}/quote`;
}

export function wwwTickerQuoteTargets(options: {
  symbol: string;
  exchange?: string;
  quoteType?: string;
}): WwwTickerQuoteTarget[] {
  const ticker = yahooSymbolToTicker(options.symbol);
  if (!ticker || extractMorningstarId(ticker)) {
    return [];
  }

  const assetType = mapYahooQuoteTypeToAssetType(options.quoteType);
  return morningstarMicsForYahooQuote(options.symbol, options.exchange).map(
    (mic) => ({
      ticker,
      mic,
      assetType,
      url: buildWwwMorningstarTickerQuoteUrl(assetType, mic, ticker),
    }),
  );
}

export function buildWwwMorningstarSearchUrl(query: string): string {
  return `https://www.morningstar.com/search?query=${encodeURIComponent(query)}`;
}

export function detectAssetTypeFromMorningstarUrl(
  url: string,
): MorningstarAssetType {
  const lower = url.toLowerCase();
  if (lower.includes('/etfs/')) {
    return MS_ASSET_TYPES.ETF;
  }
  if (lower.includes('/stocks/') || lower.includes('/acciones/')) {
    return MS_ASSET_TYPES.STOCK;
  }
  return MS_ASSET_TYPES.FUND;
}

/**
 * Quote-page identity from www.morningstar.com HTML (JSON byId / performanceId).
 * Ignores related-holding 0P IDs scattered through the page.
 */
export function parseWwwMorningstarQuoteHtml(
  html: string,
  url: string,
): WwwQuoteIdentity | null {
  if (!html) {
    return null;
  }

  const assetType = detectAssetTypeFromMorningstarUrl(url);
  const fromJson = pickQuotedId(html, [
    /"(?:performanceId|byId|securityId|secId)"\s*:\s*"(0P000[A-Z0-9]{5,7})"/gi,
  ]);
  const fromUrl = extractMorningstarId(url);
  const morningstarId = fromJson || fromUrl;
  if (!morningstarId) {
    return null;
  }

  const tickerFromUrl = url.match(
    /\/(?:stocks|etfs|funds)\/[a-z0-9]+\/([a-z0-9.-]+)(?:\/|$)/i,
  )?.[1];

  return {
    morningstarId,
    shareClassId: extractShareClassIdFromHtml(html) ?? undefined,
    isin: extractLabeledIsin(html),
    ticker: tickerFromUrl ? tickerFromUrl.toUpperCase() : undefined,
    name: extractQuoteName(html),
    assetType,
    url,
  };
}

/**
 * First quote URL on a www.morningstar.com search page whose card mentions the query
 */
export function parseWwwMorningstarSearchHtml(
  html: string,
  query: string,
): string[] {
  if (!html) {
    return [];
  }

  const quotePattern =
    /https?:\/\/www\.morningstar\.com\/(stocks|etfs|funds)\/[a-z0-9]+\/[a-z0-9.-]+\/quote/gi;
  const urls = [...new Set([...html.matchAll(quotePattern)].map((m) => m[0]))];
  const normalizedQuery = query.trim().toUpperCase();
  if (!normalizedQuery || urls.length === 0) {
    return urls.slice(0, 5);
  }

  const htmlUpper = html.toUpperCase();
  const queryIndex = htmlUpper.indexOf(normalizedQuery);
  if (queryIndex < 0) {
    return urls.slice(0, 5);
  }

  const ranked = urls
    .map((url) => {
      const idx = htmlUpper.indexOf(url.toUpperCase());
      return {
        url,
        distance:
          idx < 0 ? Number.MAX_SAFE_INTEGER : Math.abs(idx - queryIndex),
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.url);

  return ranked.slice(0, 5);
}

function mapYahooQuoteTypeToAssetType(
  quoteType: string | undefined,
): MorningstarAssetType {
  const normalized = quoteType?.toUpperCase() ?? '';
  if (normalized.includes('ETF')) {
    return MS_ASSET_TYPES.ETF;
  }
  if (normalized.includes('EQUITY') || normalized.includes('STOCK')) {
    return MS_ASSET_TYPES.STOCK;
  }
  return MS_ASSET_TYPES.FUND;
}

function pickQuotedId(html: string, patterns: RegExp[]): string | null {
  const counts = new Map<string, number>();
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const id = match[1]?.toUpperCase();
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

export function extractLabeledIsin(html: string): string | undefined {
  const labeled = [
    /"isin"\s*:\s*"([A-Z]{2}[A-Z0-9]{10})"/gi,
    /ISIN[:\s]+([A-Z]{2}[A-Z0-9]{10})/gi,
  ];
  for (const pattern of labeled) {
    for (const match of html.matchAll(pattern)) {
      const candidate = match[1]?.toUpperCase();
      if (
        candidate &&
        isValidIsin(candidate) &&
        IdentifierClassifier.validateISINChecksum(candidate)
      ) {
        return candidate;
      }
    }
  }
  return undefined;
}

function extractQuoteName(html: string): string | undefined {
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  )?.[1];
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const raw = (ogTitle || title || '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw || raw.length < 3) {
    return undefined;
  }
  return raw.replace(/\s*[|\-–].*$/, '').trim() || raw;
}

export function isAcceptableWwwQuoteIdentity(
  identity: WwwQuoteIdentity,
  query: string,
): boolean {
  const normalized = query.trim().toUpperCase();
  if (IdentifierClassifier.isISIN(normalized)) {
    return identity.isin === normalized;
  }
  if (IdentifierClassifier.isTicker(normalized)) {
    return identity.ticker === normalized;
  }
  return true;
}
