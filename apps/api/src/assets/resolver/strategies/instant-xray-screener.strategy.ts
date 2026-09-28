import { Injectable } from '@nestjs/common';
import { SearchResult } from '../resolver.types';
import { SearchStrategy } from './search-strategy.interface';
import { HttpClientService } from '../../../common/http';
import { createContextLogger } from '../../../common/logger';
import {
  buildInstantXrayScreenerUrl,
  parseInstantXrayScreenerResponse,
  rankInstantXrayResults,
  screenerUniversesForQuery,
} from '../utils/instant-xray-screener';

/** Query at most this many Instant X-Ray universes at once. */
const SCREENER_UNIVERSE_CONCURRENCY = 2;
const SCREENER_TIMEOUT_MS = 10_000;

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

  private async searchUniverse(
    query: string,
    universeId: string,
  ): Promise<SearchResult[]> {
    const response = await this.httpClient.get<unknown>(
      buildInstantXrayScreenerUrl(query, universeId),
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
      return [];
    }

    return parseInstantXrayScreenerResponse(response.data, query, universeId);
  }
}
