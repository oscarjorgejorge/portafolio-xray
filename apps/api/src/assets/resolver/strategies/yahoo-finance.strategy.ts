import { Injectable } from '@nestjs/common';
import { SearchResult } from '../resolver.types';
import { SearchStrategy } from './search-strategy.interface';
import {
  buildMorningstarUrl,
  buildYahooFinanceSearchUrl,
} from '../utils/url-builder';
import { extractMorningstarId, isValidIsin } from '../utils/id-extractor';
import { IdentifierClassifier } from '../../../common/utils/identifier-classifier';
import { safeJsonParse } from '../utils/error-handler';
import { HttpClientService } from '../../../common/http';
import { createContextLogger } from '../../../common/logger';
import { MS_ASSET_TYPES, MorningstarAssetType } from '../utils/constants';
import {
  buildWwwMorningstarSearchUrl,
  isAcceptableWwwQuoteIdentity,
  parseWwwMorningstarQuoteHtml,
  parseWwwMorningstarSearchHtml,
  wwwTickerQuoteTargets,
  yahooSymbolToTicker,
  type WwwQuoteIdentity,
} from '../utils/www-morningstar-quote';

interface YahooFinanceQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  typeDisp?: string;
  exchange?: string;
  exch?: string;
}

interface YahooFinanceSearchResponse {
  quotes?: YahooFinanceQuote[];
}

const MAX_WWW_QUOTE_LOOKUPS = 4;

/**
 * Yahoo Finance search. Morningstar search endpoints are often WAF-blocked.
 * Funds sometimes expose 0P IDs as Yahoo symbols; stocks/ETFs usually need a
 * follow-up lookup on www.morningstar.com/{stocks|etfs}/{mic}/{ticker}/quote.
 */
@Injectable()
export class YahooFinanceSearchStrategy implements SearchStrategy {
  private readonly logger = createContextLogger(
    YahooFinanceSearchStrategy.name,
  );
  readonly name = 'YAHOO';

  constructor(private readonly httpClient: HttpClientService) {}

  async search(query: string): Promise<SearchResult[]> {
    this.logger.debug(`[${this.name}] Searching Yahoo Finance for: ${query}`);

    const response = await this.httpClient.get<string>(
      buildYahooFinanceSearchUrl(query),
      {
        responseType: 'text',
        timeout: 10000,
        headers: { Accept: 'application/json' },
      },
    );

    if (!response.ok || !response.data) {
      return this.lookupViaWwwSearch(query);
    }

    const fromSymbols = parseYahooFinanceSearch(response.data, query);
    if (fromSymbols.length > 0) {
      this.logger.debug(
        `[${this.name}] Found ${fromSymbols.length} Morningstar IDs in Yahoo symbols`,
      );
      return fromSymbols;
    }

    const quotes = orderYahooQuotesForWwwLookup(
      parseYahooQuotes(response.data),
      query,
    );
    const fromTickerPages = await this.lookupWwwQuotePages(query, quotes);
    if (fromTickerPages.length > 0) {
      this.logger.debug(
        `[${this.name}] Found ${fromTickerPages.length} result(s) via www.morningstar.com ticker pages`,
      );
      return fromTickerPages;
    }

    return this.lookupViaWwwSearch(query);
  }

  private async lookupWwwQuotePages(
    query: string,
    quotes: YahooFinanceQuote[],
  ): Promise<SearchResult[]> {
    const targets = quotes
      .filter((quote) => quote.symbol && !extractMorningstarId(quote.symbol))
      .flatMap((quote) =>
        wwwTickerQuoteTargets({
          symbol: quote.symbol!,
          exchange: quote.exchange ?? quote.exch,
          quoteType: quote.quoteType ?? quote.typeDisp,
        }),
      )
      .slice(0, MAX_WWW_QUOTE_LOOKUPS);

    for (const target of targets) {
      const identity = await this.fetchQuoteIdentity(target.url);
      if (identity && isAcceptableWwwQuoteIdentity(identity, query)) {
        return [wwwIdentityToSearchResult(identity, query)];
      }
    }

    return [];
  }

  private async lookupViaWwwSearch(query: string): Promise<SearchResult[]> {
    const response = await this.httpClient.get<string>(
      buildWwwMorningstarSearchUrl(query),
      { responseType: 'html', timeout: 15000 },
    );
    if (!response.ok || !response.data) {
      return [];
    }

    const quoteUrls = parseWwwMorningstarSearchHtml(response.data, query);
    for (const url of quoteUrls.slice(0, 3)) {
      const identity = await this.fetchQuoteIdentity(url);
      if (identity && isAcceptableWwwQuoteIdentity(identity, query)) {
        this.logger.debug(
          `[${this.name}] www.morningstar.com search resolved ${query} -> ${identity.morningstarId}`,
        );
        return [wwwIdentityToSearchResult(identity, query)];
      }
    }

    return [];
  }

  private async fetchQuoteIdentity(
    url: string,
  ): Promise<WwwQuoteIdentity | null> {
    const response = await this.httpClient.get<string>(url, {
      responseType: 'html',
      timeout: 15000,
    });
    if (!response.ok || !response.data) {
      return null;
    }
    return parseWwwMorningstarQuoteHtml(response.data, url);
  }
}

export function parseYahooFinanceSearch(
  text: string,
  query: string,
): SearchResult[] {
  const data = safeJsonParse<YahooFinanceSearchResponse>(text);
  if (!data?.quotes?.length) {
    return [];
  }

  const queryIsin = isValidIsin(query) ? query.toUpperCase() : undefined;
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const quote of data.quotes) {
    const morningstarId = extractMorningstarIdFromYahooQuote(quote);
    if (!morningstarId || seen.has(morningstarId)) {
      continue;
    }
    seen.add(morningstarId);

    const assetType = mapYahooQuoteType(quote.quoteType ?? quote.typeDisp);
    const title =
      meaningfulYahooName(quote.longname, morningstarId) ||
      meaningfulYahooName(quote.shortname, morningstarId) ||
      morningstarId;

    results.push({
      url: buildMorningstarUrl(morningstarId, assetType, 'eu'),
      title,
      snippet: `Yahoo Finance | ${query} | ${quote.quoteType ?? quote.typeDisp ?? ''}`,
      morningstarId,
      domain: 'global.morningstar.com',
      isin: queryIsin,
      ticker: quote.symbol,
      assetType,
    });
  }

  return results;
}

export function parseYahooQuotes(text: string): YahooFinanceQuote[] {
  const data = safeJsonParse<YahooFinanceSearchResponse>(text);
  return data?.quotes?.filter((quote) => quote.symbol) ?? [];
}

/**
 * Exact ticker matches first so secondary listings (8FS) do not consume
 * the www.morningstar.com lookup budget.
 */
export function orderYahooQuotesForWwwLookup(
  quotes: YahooFinanceQuote[],
  query: string,
): YahooFinanceQuote[] {
  const normalized = query.trim().toUpperCase();
  if (!normalized || IdentifierClassifier.isISIN(normalized)) {
    return quotes;
  }

  const exact: YahooFinanceQuote[] = [];
  const rest: YahooFinanceQuote[] = [];
  for (const quote of quotes) {
    if (!quote.symbol) continue;
    if (yahooSymbolToTicker(quote.symbol) === normalized) {
      exact.push(quote);
    } else {
      rest.push(quote);
    }
  }
  return [...exact, ...rest];
}

function wwwIdentityToSearchResult(
  identity: WwwQuoteIdentity,
  query: string,
): SearchResult {
  return {
    url: identity.url,
    title: identity.name || identity.morningstarId,
    snippet: `www.morningstar.com | ${query} | ${identity.assetType}`,
    morningstarId: identity.morningstarId,
    domain: 'www.morningstar.com',
    isin: identity.isin,
    ticker: identity.ticker,
    shareClassId: identity.shareClassId,
    assetType: identity.assetType,
  };
}

function extractMorningstarIdFromYahooQuote(
  quote: YahooFinanceQuote,
): string | null {
  return (
    extractMorningstarId(quote.symbol ?? '') ||
    extractMorningstarId(quote.shortname ?? '') ||
    extractMorningstarId(quote.longname ?? '')
  );
}

function meaningfulYahooName(
  name: string | undefined,
  morningstarId: string,
): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (extractMorningstarId(trimmed) === morningstarId && !/\s/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function mapYahooQuoteType(
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
