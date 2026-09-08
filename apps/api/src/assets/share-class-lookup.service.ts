import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssetType } from '@prisma/client';
import { HttpClientService } from '../common/http';
import { createContextLogger } from '../common/logger';
import type { AppConfig } from '../config';
import { extractShareClassIdFromHtml } from './resolver/utils/canonical-fund-id';
import {
  MS_ASSET_TYPES,
  SHARE_CLASS_LOOKUP_RETRIES,
  SHARE_CLASS_LOOKUP_RETRY_DELAY_MS,
  isMorningstarBotChallenge,
  type MorningstarAssetType,
} from './resolver/utils/constants';
import { shareClassIdLookupUrls } from './resolver/utils/url-builder';

/**
 * Fetches Instant X-Ray F IDs from Morningstar quote pages.
 * Used only by background enrichment — not by X-Ray URL generation.
 */
@Injectable()
export class ShareClassLookupService {
  private readonly logger = createContextLogger(ShareClassLookupService.name);
  private readonly timeoutMs: number;

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    const resolutionConfig = this.configService.get('resolution', {
      infer: true,
    });
    this.timeoutMs = resolutionConfig.shareClassEnrichmentTimeoutMs;
  }

  async lookupForAsset(asset: {
    morningstarId: string;
    url?: string | null;
    type?: string | null;
  }): Promise<string | null> {
    const urls = shareClassIdLookupUrls(
      asset.morningstarId,
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
          `[SHARE-CLASS] Stopped lookup for ${asset.morningstarId} after bot challenge`,
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
