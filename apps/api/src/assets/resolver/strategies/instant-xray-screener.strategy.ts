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

/**
 * Instant X-Ray security screener on lt.morningstar.com.
 * www/global Morningstar search is often WAF-blocked; this endpoint is the
 * same family Instant X-Ray uses and returns 0P IDs, ISINs and tickers.
 */
@Injectable()
export class InstantXrayScreenerStrategy implements SearchStrategy {
  private readonly logger = createContextLogger(
    InstantXrayScreenerStrategy.name,
  );
  readonly name = 'XRAY_SCREENER';

  constructor(private readonly httpClient: HttpClientService) {}

  async search(query: string): Promise<SearchResult[]> {
    const universes = screenerUniversesForQuery(query);
    this.logger.debug(
      `[${this.name}] Searching Instant X-Ray screener for: ${query} (${universes.length} universes)`,
    );

    const settled = await Promise.allSettled(
      universes.map((universeId) => this.searchUniverse(query, universeId)),
    );

    const merged: SearchResult[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        merged.push(...result.value);
      }
    }

    const ranked = rankInstantXrayResults(merged, query);
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
        timeout: 10000,
        headers: { Accept: 'application/json' },
      },
    );

    if (!response.ok || !response.data) {
      return [];
    }

    return parseInstantXrayScreenerResponse(response.data, query, universeId);
  }
}
