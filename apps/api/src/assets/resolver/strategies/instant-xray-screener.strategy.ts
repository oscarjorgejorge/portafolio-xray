import { Injectable } from '@nestjs/common';
import { SearchResult } from '../resolver.types';
import { SearchStrategy } from './search-strategy.interface';
import { HttpClientService } from '../../../common/http';
import { createContextLogger } from '../../../common/logger';
import { IdentifierClassifier } from '../../../common/utils/identifier-classifier';
import {
  buildInstantXrayScreenerUrl,
  collapseListingsByIsin,
  exchangeFromSnippet,
  parseInstantXrayScreenerResponse,
  rankInstantXrayResults,
  SCREENER_TICKER_PAGE_SIZE,
  screenerUniversesForQuery,
  type InstantXrayScreenerResponse,
} from '../utils/instant-xray-screener';
import { parseListingSymbol } from '../utils/www-morningstar-quote';

/** Query at most this many Instant X-Ray universes at once. */
const SCREENER_UNIVERSE_CONCURRENCY = 2;
const SCREENER_TIMEOUT_MS = 10_000;
/** Ticker filters can return more listings than one page. */
const MAX_TICKER_PAGES = 4;

/**
 * Instant X-Ray security screener on lt.morningstar.com.
 * www/global Morningstar search is often WAF-blocked; this endpoint is the
 * same family Instant X-Ray uses and returns 0P IDs, ISINs and tickers.
 *
 * Universes are queried in small parallel batches (not one joined request):
 * a multi-universe URL often times out on serverless hosts.
 */
@Injectable()
export class InstantXrayScreenerStrategy implements SearchStrategy {
  private readonly logger = createContextLogger(
    InstantXrayScreenerStrategy.name,
  );
  readonly name = 'XRAY_SCREENER';

  constructor(private readonly httpClient: HttpClientService) {}

  async search(query: string): Promise<SearchResult[]> {
    if (IdentifierClassifier.isTicker(query)) {
      return this.searchByTicker(query);
    }

    const universes = [...screenerUniversesForQuery(query)];
    this.logger.debug(
      `[${this.name}] Searching Instant X-Ray screener for: ${query} ` +
        `(${universes.length} universes, concurrency ${SCREENER_UNIVERSE_CONCURRENCY})`,
    );

    const collected: SearchResult[] = [];

    for (let i = 0; i < universes.length; i += SCREENER_UNIVERSE_CONCURRENCY) {
      const batch = universes.slice(i, i + SCREENER_UNIVERSE_CONCURRENCY);
      const batchHits = await Promise.all(
        batch.map((universeId) => this.searchUniverse(query, universeId)),
      );

      for (const hits of batchHits) {
        collected.push(...hits);
      }

      if (collected.length > 0) {
        this.logger.debug(
          `[${this.name}] Stopping after universe batch starting at ${batch[0]} ` +
            `(${collected.length} raw hit(s))`,
        );
        break;
      }
    }

    const ranked = rankInstantXrayResults(collected, query);
    this.logger.debug(
      `[${this.name}] Unique Instant X-Ray hits for ${query}: ${ranked.length}`,
    );
    return ranked;
  }

  /**
   * Exact ticker filter on the equity and ETF universes.
   * Name search (`term`) misses listings such as BBVA on Madrid.
   */
  private async searchByTicker(query: string): Promise<SearchResult[]> {
    const universes = [...screenerUniversesForQuery(query)];
    this.logger.debug(
      `[${this.name}] Ticker filter for ${query} on ${universes.join(', ')}`,
    );

    const batches = await Promise.all(
      universes.map((universeId) => this.searchUniverse(query, universeId)),
    );
    let ranked = rankInstantXrayResults(batches.flat(), query);
    const pinnedMics = parseListingSymbol(query).mics;
    if (pinnedMics?.length) {
      const pinned = ranked.filter((result) => {
        const mic = exchangeFromSnippet(result.snippet)?.toUpperCase();
        return mic ? pinnedMics.includes(mic) : false;
      });
      if (pinned.length > 0) {
        ranked = pinned;
      }
    }
    const collapsed = collapseListingsByIsin(ranked);
    this.logger.debug(
      `[${this.name}] Ticker hits for ${query}: ${collapsed.length}`,
    );
    return collapsed;
  }

  private async searchUniverse(
    query: string,
    universeId: string,
  ): Promise<SearchResult[]> {
    const tickerLookup = IdentifierClassifier.isTicker(query);
    const collected: SearchResult[] = [];
    let seenRows = 0;
    let total = 0;

    for (let page = 1; page <= (tickerLookup ? MAX_TICKER_PAGES : 1); page++) {
      const response = await this.httpClient.get<InstantXrayScreenerResponse>(
        buildInstantXrayScreenerUrl(query, universeId, page),
        {
          responseType: 'json',
          timeout: SCREENER_TIMEOUT_MS,
          retries: 1,
          retryDelay: 400,
          headers: { Accept: 'application/json' },
        },
      );

      if (!response.ok || !response.data) {
        this.logger.debug(
          `[${this.name}] No screener data for ${query} in ${universeId}`,
        );
        break;
      }

      const rawRows = Array.isArray(response.data.rows)
        ? response.data.rows.length
        : 0;
      total = response.data.total ?? rawRows;
      seenRows += rawRows;
      collected.push(
        ...parseInstantXrayScreenerResponse(response.data, query, universeId),
      );

      if (!tickerLookup || rawRows === 0 || seenRows >= total) {
        break;
      }
      if (rawRows < SCREENER_TICKER_PAGE_SIZE) {
        break;
      }
    }

    return collected;
  }
}
