import { IdentifierClassifier } from '../../../common/utils/identifier-classifier';
import { SearchResult } from '../resolver.types';
import { namesLookSimilar } from './canonical-fund-id';
import { MS_ASSET_TYPES, MorningstarAssetType } from './constants';
import {
  extractMorningstarId,
  isFundShareClassId,
  isPerformanceId,
} from './id-extractor';
import { buildMorningstarUrl } from './url-builder';

export const INSTANT_XRAY_SCREENER_BASE_URL =
  'https://lt.morningstar.com/api/rest.svc/klr5zyak8x/security/screener';

export const INSTANT_XRAY_ISIN_UNIVERSES = [
  'FOESP$$ALL',
  'FOEUR$$ALL',
  'FOGBR$$ALL',
  'ETALL$$ALL',
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

const PREFERRED_UNIVERSES = [
  'FOESP$$ALL',
  'FOEUR$$ALL',
  'FOGBR$$ALL',
  'ETALL$$ALL',
  'E0WWE$$ALL',
] as const;

export interface InstantXrayScreenerRow {
  SecId?: string;
  Name?: string;
  Ticker?: string;
  ISIN?: string;
  PerformanceId?: string;
  ExchangeId?: string;
  ShareClassId?: string;
  FundShareClassId?: string;
  Universe?: string;
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
      'SecId|Name|Ticker|ISIN|PerformanceId|ExchangeId|ShareClassId|FundShareClassId|Universe',
  });
  return `${INSTANT_XRAY_SCREENER_BASE_URL}?${params.toString()}`;
}

export function joinScreenerUniverseIds(universes: readonly string[]): string {
  return universes.join('|');
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

  const results: SearchResult[] = [];

  for (const row of rows) {
    if (!rowMatchesQuery(row, query)) {
      continue;
    }
    const morningstarId = morningstarIdFromScreenerRow(row);
    if (!morningstarId) {
      continue;
    }

    const rowUniverse = resolveRowUniverse(row.Universe, universeId);
    const assetType = assetTypeFromUniverse(rowUniverse);
    const ticker = row.Ticker?.trim().toUpperCase() || undefined;
    const isin = row.ISIN?.trim().toUpperCase() || undefined;
    const shareClassId = shareClassIdFromScreenerRow(row);

    results.push({
      url: buildMorningstarUrl(morningstarId, assetType, 'eu'),
      title: row.Name?.trim() || morningstarId,
      snippet: `Instant X-Ray | ${rowUniverse} | ${parseExchangeMic(row.ExchangeId) ?? ''}`,
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

export function universeRank(universeId?: string): number {
  if (!universeId) {
    return PREFERRED_UNIVERSES.length + 1;
  }
  const normalized = universeId.trim().toUpperCase();
  const index = PREFERRED_UNIVERSES.indexOf(
    normalized as (typeof PREFERRED_UNIVERSES)[number],
  );
  if (index !== -1) {
    return index;
  }
  if (normalized.startsWith('FO')) {
    return PREFERRED_UNIVERSES.indexOf('FOGBR$$ALL');
  }
  if (normalized.startsWith('ET')) {
    return PREFERRED_UNIVERSES.indexOf('ETALL$$ALL');
  }
  if (normalized.startsWith('E0')) {
    return PREFERRED_UNIVERSES.indexOf('E0WWE$$ALL');
  }
  return PREFERRED_UNIVERSES.length;
}

export function rankInstantXrayResults(
  results: SearchResult[],
  query: string,
): SearchResult[] {
  const normalized = query.trim().toUpperCase();
  const bestById = new Map<string, SearchResult>();

  for (const result of results) {
    const key = result.morningstarId?.toUpperCase();
    if (!key) {
      continue;
    }
    const existing = bestById.get(key);
    if (!existing || screenerHitRank(result) < screenerHitRank(existing)) {
      bestById.set(key, result);
    }
  }

  return [...bestById.values()].sort((a, b) => {
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

    const hitRank = screenerHitRank(a) - screenerHitRank(b);
    if (hitRank !== 0) {
      return hitRank;
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

export type ScreenerIdentityHit = {
  shareClassId: string | null;
  isin?: string;
};

export type ScreenerIdentityExpected = {
  isin?: string | null;
  performanceId?: string | null;
  name?: string | null;
};

function fundShareClassIdFromResult(result: SearchResult): string | null {
  if (isFundShareClassId(result.shareClassId)) {
    return result.shareClassId as string;
  }
  if (isFundShareClassId(result.morningstarId)) {
    return result.morningstarId;
  }
  return null;
}

/**
 * Instant X-Ray F ID that matches the user's ISIN (and 0P / name when no ISIN).
 * Never returns an F ID from a different share class.
 */
export function pickVerifiedIdentityFromScreenerResults(
  results: SearchResult[],
  expected?: ScreenerIdentityExpected,
): ScreenerIdentityHit {
  const expectedIsin = expected?.isin?.trim().toUpperCase();
  const expectedPerf = expected?.performanceId?.trim().toUpperCase();
  const expectedName = expected?.name?.trim();
  const requireMatch = Boolean(
    expectedIsin || (expectedPerf && isPerformanceId(expectedPerf)),
  );

  const matched = results.filter((result) => {
    if (!fundShareClassIdFromResult(result)) {
      return false;
    }
    if (expectedIsin) {
      return result.isin?.toUpperCase() === expectedIsin;
    }
    if (expectedPerf && isPerformanceId(expectedPerf)) {
      if (result.morningstarId?.toUpperCase() !== expectedPerf) {
        return false;
      }
      if (expectedName && result.title) {
        return namesLookSimilar(expectedName, result.title);
      }
      return true;
    }
    return true;
  });

  if (matched.length === 0) {
    const withIsin = results.find((result) => result.isin);
    return {
      shareClassId: requireMatch
        ? null
        : pickShareClassIdFromScreenerResults(results),
      isin: expectedIsin || withIsin?.isin,
    };
  }

  const best = matched[0];
  return {
    shareClassId: fundShareClassIdFromResult(best),
    isin: best.isin || expectedIsin,
  };
}

export function pickIdentityFromScreenerResults(
  results: SearchResult[],
  expected?: ScreenerIdentityExpected,
): ScreenerIdentityHit {
  if (expected) {
    return pickVerifiedIdentityFromScreenerResults(results, expected);
  }
  const shareClassId = pickShareClassIdFromScreenerResults(results);
  const withIsin = results.find((result) => result.isin);
  return {
    shareClassId,
    isin: withIsin?.isin,
  };
}

function resolveRowUniverse(
  rowUniverse: string | undefined,
  fallbackUniverseId: string,
): string {
  const fromRow = rowUniverse?.trim();
  if (fromRow) {
    return fromRow;
  }
  if (!fallbackUniverseId.includes('|')) {
    return fallbackUniverseId;
  }
  return fallbackUniverseId.split('|')[0] ?? fallbackUniverseId;
}

function universeFromSnippet(snippet: string): string | undefined {
  const parts = snippet.split('|').map((part) => part.trim());
  return parts[1] || undefined;
}

function screenerHitRank(result: SearchResult): number {
  const hasShareClass =
    isFundShareClassId(result.shareClassId) ||
    isFundShareClassId(result.morningstarId)
      ? 0
      : 1;
  return (
    hasShareClass * 100 + universeRank(universeFromSnippet(result.snippet))
  );
}

function exchangeFromSnippet(snippet: string): string | undefined {
  const parts = snippet.split('|').map((part) => part.trim());
  return parts[2] || undefined;
}
