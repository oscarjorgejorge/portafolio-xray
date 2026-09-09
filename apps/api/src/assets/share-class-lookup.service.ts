import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssetType } from '@prisma/client';
import { HttpClientService } from '../common/http';
import { createContextLogger } from '../common/logger';
import type { AppConfig } from '../config';
import {
  extractShareClassIdFromHtml,
  resolveShareClassLookupId,
} from './resolver/utils/canonical-fund-id';
import { pickIdentityFromScreenerResults } from './resolver/utils/instant-xray-screener';
import {
  MS_ASSET_TYPES,
  SHARE_CLASS_LOOKUP_RETRIES,
  SHARE_CLASS_LOOKUP_RETRY_DELAY_MS,
  isMorningstarBotChallenge,
  type MorningstarAssetType,
} from './resolver/utils/constants';
import { shareClassIdLookupUrls } from './resolver/utils/url-builder';
import { InstantXrayScreenerStrategy } from './resolver/strategies/instant-xray-screener.strategy';

/**
 * Fetches Instant X-Ray F IDs from the screener (preferred) or quote pages.
 * Generate uses the screener path only; quote pages stay in background enrichment.
 */
@Injectable()
export class ShareClassLookupService {
  private readonly logger = createContextLogger(ShareClassLookupService.name);
  private readonly timeoutMs: number;

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly screener: InstantXrayScreenerStrategy,
  ) {
    const resolutionConfig = this.configService.get('resolution', {
      infer: true,
    });
    this.timeoutMs = resolutionConfig.shareClassEnrichmentTimeoutMs;
  }

  /**
   * Instant X-Ray F ID from the screener only (no quote-page scrape).
   * Safe to call from generate: lt.morningstar.com is the same API Instant X-Ray uses.
   */
  async lookupShareClassIdFromScreener(asset: {
    morningstarId: string;
    isin?: string | null;
    url?: string | null;
  }): Promise<string | null> {
    const identity = await this.lookupIdentityFromScreener(asset);
    return identity.shareClassId;
  }

  async lookupIdentityFromScreener(asset: {
    morningstarId: string;
    isin?: string | null;
    url?: string | null;
  }): Promise<{ shareClassId: string | null; isin?: string }> {
    return this.lookupFromScreener(asset);
  }

  async lookupIdentityForAsset(asset: {
    morningstarId: string;
    url?: string | null;
    type?: string | null;
    isin?: string | null;
  }): Promise<{ shareClassId: string | null; isin?: string }> {
    const fromScreener = await this.lookupFromScreener(asset);
    if (fromScreener.shareClassId) {
      return fromScreener;
    }
    const fromQuote = await this.lookupFromQuotePages(asset);
    return {
      shareClassId: fromQuote,
      isin: fromScreener.isin,
    };
  }

  async lookupForAsset(asset: {
    morningstarId: string;
    url?: string | null;
    type?: string | null;
    isin?: string | null;
  }): Promise<string | null> {
    const identity = await this.lookupIdentityForAsset(asset);
    return identity.shareClassId;
  }

  private async lookupFromScreener(asset: {
    morningstarId: string;
    isin?: string | null;
    url?: string | null;
  }): Promise<{ shareClassId: string | null; isin?: string }> {
    const terms = this.screenerTerms(asset);
    for (const term of terms) {
      try {
        const results = await this.screener.search(term);
        const identity = pickIdentityFromScreenerResults(results);
        if (identity.shareClassId || identity.isin) {
          if (identity.shareClassId) {
            this.logger.log(
              `[SHARE-CLASS] Share-class ID from Instant X-Ray screener ${term}: ${identity.shareClassId}`,
            );
          }
          return identity;
        }
      } catch (error) {
        this.logger.warn(
          `[SHARE-CLASS] Screener lookup failed for ${term}: ${error}`,
        );
      }
    }
    return { shareClassId: null };
  }

  private screenerTerms(asset: {
    morningstarId: string;
    isin?: string | null;
    url?: string | null;
  }): string[] {
    const terms: string[] = [];
    if (asset.isin) {
      terms.push(asset.isin.trim().toUpperCase());
    }
    const lookupId = resolveShareClassLookupId(asset);
    if (lookupId && !terms.includes(lookupId)) {
      terms.push(lookupId);
    }
    return terms;
  }

  private async lookupFromQuotePages(asset: {
    morningstarId: string;
    url?: string | null;
    type?: string | null;
  }): Promise<string | null> {
    const lookupId = resolveShareClassLookupId(asset);
    if (!lookupId) {
      return null;
    }
    const urls = shareClassIdLookupUrls(
      lookupId,
      asset.url,
      this.toMsAssetType(asset.type),
    );
    for (const url of urls) {
      const { shareClassId, blocked } = await this.fetchFromQuotePage(url);
      if (shareClassId) {
        return shareClassId;
      }
      if (blocked) {
        this.logger.warn(
          `[SHARE-CLASS] Stopped quote lookup for ${asset.morningstarId} after bot challenge`,
        );
        break;
      }
    }
    return null;
  }

  private toMsAssetType(type: string | null | undefined): MorningstarAssetType {
    if (type === AssetType.ETF) {
      return MS_ASSET_TYPES.ETF;
    }
    if (type === AssetType.STOCK) {
      return MS_ASSET_TYPES.STOCK;
    }
    return MS_ASSET_TYPES.FUND;
  }

  private async fetchFromQuotePage(
    url: string,
  ): Promise<{ shareClassId: string | null; blocked: boolean }> {
    try {
      const response = await this.httpClient.get<string>(url, {
        responseType: 'html',
        timeout: this.timeoutMs,
        retries: SHARE_CLASS_LOOKUP_RETRIES,
        retryDelay: SHARE_CLASS_LOOKUP_RETRY_DELAY_MS,
      });
      if (!response.ok || !response.data) {
        return {
          shareClassId: null,
          blocked: isMorningstarBotChallenge(
            response.status,
            response.error?.message,
          ),
        };
      }
      const shareClassId = extractShareClassIdFromHtml(response.data);
      if (shareClassId) {
        this.logger.log(
          `[SHARE-CLASS] Share-class ID from quote page ${url}: ${shareClassId}`,
        );
      }
      return { shareClassId, blocked: false };
    } catch (error) {
      this.logger.warn(
        `[SHARE-CLASS] Failed to read share-class ID from ${url}: ${error}`,
      );
      return { shareClassId: null, blocked: false };
    }
  }
}
