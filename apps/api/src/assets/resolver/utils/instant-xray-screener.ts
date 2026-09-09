import { IdentifierClassifier } from '../../../common/utils/identifier-classifier';
import { SearchResult } from '../resolver.types';
import { MS_ASSET_TYPES, MorningstarAssetType } from './constants';
import { extractMorningstarId, isFundShareClassId } from './id-extractor';
import { buildMorningstarUrl } from './url-builder';

export const INSTANT_XRAY_SCREENER_BASE_URL =
  'https://lt.morningstar.com/api/rest.svc/klr5zyak8x/security/screener';

export const INSTANT_XRAY_ISIN_UNIVERSES = [
  'ETALL$$ALL',
  'FOESP$$ALL',
  'E0WWE$$ALL',
] as const;

export const INSTANT_XRAY_TICKER_UNIVERSES = [
  'E0EXG$XNAS',
  'E0EXG$XNYS',
  'E0EXG$XLON',
  'E0EXG$XPAR',
  'E0EXG$XMCE',
  'ETEXG$XLON',
  'ETEXG$XETR',
  'ETEXG$XMCE',
] as const;

const PREFERRED_EXCHANGES = [
  'XNAS',
  'XNYS',
  'XLON',
  'XETR',
  'XMCE',
  'XPAR',
  'XAMS',
  'XSWX',
];

export interface InstantXrayScreenerRow {
  SecId?: string;
  Name?: string;
  Ticker?: string;
  ISIN?: string;
  PerformanceId?: string;
  ExchangeId?: string;
  ShareClassId?: string;
  FundShareClassId?: string;
}

export interface InstantXrayScreenerResponse {
  total?: number;
  rows?: InstantXrayScreenerRow[];
}

export function buildInstantXrayScreenerUrl(
  term: string,
  universeId: string,
): string {
  const params = new URLSearchParams({
    page: '1',
    pageSize: '15',
    sortOrder: 'LegalName asc',
    outputType: 'json',
    version: '1',
    languageId: 'es-ES',
    currencyId: 'EUR',
    universeIds: universeId,
    term,
    securityDataPoints:
      'SecId|Name|Ticker|ISIN|PerformanceId|ExchangeId|ShareClassId',
  });
  return `${INSTANT_XRAY_SCREENER_BASE_URL}?${params.toString()}`;
}

export function screenerUniversesForQuery(query: string): readonly string[] {
  if (
    IdentifierClassifier.isISIN(query) ||
    IdentifierClassifier.isMorningstarId(query)
  ) {
    return INSTANT_XRAY_ISIN_UNIVERSES;
  }
  return INSTANT_XRAY_TICKER_UNIVERSES;
}

export function parseExchangeMic(exchangeId?: string): string | undefined {
  if (!exchangeId) return undefined;
  const match = exchangeId.toUpperCase().match(/([A-Z0-9]{3,5})$/);
  return match?.[1];
}

export function assetTypeFromUniverse(
  universeId: string,
): MorningstarAssetType {
  const universe = universeId.toUpperCase();
  if (universe.startsWith('ET') || universe.includes('ETF')) {
    return MS_ASSET_TYPES.ETF;
  }
  if (universe.startsWith('E0')) {
    return MS_ASSET_TYPES.STOCK;
  }
  return MS_ASSET_TYPES.FUND;
}

export function morningstarIdFromScreenerRow(
  row: InstantXrayScreenerRow,
): string | null {
  const candidates = [row.PerformanceId, row.SecId, row.ShareClassId];
  for (const candidate of candidates) {
    const id = extractMorningstarId(candidate ?? '');
    if (id) {
      return id;
    }
  }
  return null;
}

/**
 * Instant X-Ray often puts the F share-class ID in SecId and leaves
 * ShareClassId empty. PerformanceId stays the 0P quote ID.
 */
export function shareClassIdFromScreenerRow(
  row: InstantXrayScreenerRow,
): string | undefined {
  const candidates = [row.ShareClassId, row.FundShareClassId, row.SecId];
  for (const candidate of candidates) {
    const value = candidate?.trim().toUpperCase();
    if (value && isFundShareClassId(value)) {
      return value;
    }
  }
  return undefined;
}

export function rowMatchesQuery(
  row: InstantXrayScreenerRow,
  query: string,
): boolean {
  const normalized = query.trim().toUpperCase();
  if (!normalized) {
    return false;
  }

  if (IdentifierClassifier.isISIN(normalized)) {
    return row.ISIN?.toUpperCase() === normalized;
  }

  if (IdentifierClassifier.isMorningstarId(normalized)) {
    return [
      row.PerformanceId,
      row.SecId,
      row.ShareClassId,
      row.FundShareClassId,
    ].some((id) => id?.trim().toUpperCase() === normalized);
  }

  return row.Ticker?.toUpperCase() === normalized;
}

export function exchangeRank(exchangeId?: string): number {
  const mic = parseExchangeMic(exchangeId);
  if (!mic) {
    return PREFERRED_EXCHANGES.length + 1;
  }
  const index = PREFERRED_EXCHANGES.indexOf(mic);
  return index === -1 ? PREFERRED_EXCHANGES.length : index;
}

export function parseInstantXrayScreenerResponse(
  payload: unknown,
  query: string,
  universeId: string,
): SearchResult[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const rows = (payload as InstantXrayScreenerResponse).rows;
  if (!Array.isArray(rows)) {
    return [];
  }

  const assetType = assetTypeFromUniverse(universeId);
  const results: SearchResult[] = [];

  for (const row of rows) {
    if (!rowMatchesQuery(row, query)) {
      continue;
    }
    const morningstarId = morningstarIdFromScreenerRow(row);
    if (!morningstarId) {
      continue;
    }

    const ticker = row.Ticker?.trim().toUpperCase() || undefined;
    const isin = row.ISIN?.trim().toUpperCase() || undefined;
    const shareClassId = shareClassIdFromScreenerRow(row);

    results.push({
      url: buildMorningstarUrl(morningstarId, assetType, 'eu'),
      title: row.Name?.trim() || morningstarId,
      snippet: `Instant X-Ray | ${universeId} | ${parseExchangeMic(row.ExchangeId) ?? ''}`,
      morningstarId,
      domain: 'lt.morningstar.com',
      ticker,
      isin,
      shareClassId:
        shareClassId && shareClassId !== morningstarId
          ? shareClassId
          : undefined,
      assetType,
    });
  }

  return results;
}

export function rankInstantXrayResults(
  results: SearchResult[],
  query: string,
): SearchResult[] {
  const normalized = query.trim().toUpperCase();
  const seen = new Set<string>();
  const unique: SearchResult[] = [];

  for (const result of results) {
    const key = result.morningstarId?.toUpperCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(result);
  }

  return unique.sort((a, b) => {
    const aExactTicker =
      a.ticker?.toUpperCase() === normalized &&
      IdentifierClassifier.isTicker(normalized)
        ? 0
        : 1;
    const bExactTicker =
      b.ticker?.toUpperCase() === normalized &&
      IdentifierClassifier.isTicker(normalized)
        ? 0
        : 1;
    if (aExactTicker !== bExactTicker) {
      return aExactTicker - bExactTicker;
    }

    const aExchange = exchangeRank(exchangeFromSnippet(a.snippet));
    const bExchange = exchangeRank(exchangeFromSnippet(b.snippet));
    return aExchange - bExchange;
  });
}

/**
 * Instant X-Ray F ID from screener hits (SecId / ShareClassId).
 */
export function pickShareClassIdFromScreenerResults(
  results: SearchResult[],
): string | null {
  for (const result of results) {
    if (isFundShareClassId(result.shareClassId)) {
      return result.shareClassId as string;
    }
    if (isFundShareClassId(result.morningstarId)) {
      return result.morningstarId as string;
    }
  }
  return null;
}

function exchangeFromSnippet(snippet: string): string | undefined {
  const parts = snippet.split('|').map((part) => part.trim());
  return parts[2] || undefined;
}
