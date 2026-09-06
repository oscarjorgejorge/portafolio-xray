import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateXRayDto, XRayAssetDto } from './dto';
import { AssetsRepository } from '../assets/assets.repository';
import type { AppConfig } from '../config';
import { AssetType, type Asset } from '@prisma/client';
import { IXRayService } from './interfaces';
import { GenerateXRayResponse } from './types';
import {
  getMorningstarTypeCode,
  getMorningstarExchangeCode,
} from './constants';
import { MORNINGSTAR_URL } from '../common/constants';
import { HttpClientService } from '../common/http';
import {
  extractPreferredFundId,
  extractShareClassIdFromHtml,
  isFundLikeType,
  isFundShareClassId,
  isPerformanceId,
  pickPreferredFundAsset,
} from '../assets/resolver/utils/canonical-fund-id';
import {
  MS_ASSET_TYPES,
  SHARE_CLASS_LOOKUP_GAP_MS,
  SHARE_CLASS_LOOKUP_RETRIES,
  SHARE_CLASS_LOOKUP_RETRY_DELAY_MS,
  isMorningstarBotChallenge,
  type MorningstarAssetType,
} from '../assets/resolver/utils/constants';
import { shareClassIdLookupUrls } from '../assets/resolver/utils/url-builder';
import { createContextLogger } from '../common/logger';

@Injectable()
export class XRayService implements IXRayService {
  private readonly logger = createContextLogger(XRayService.name);
  private readonly morningstarBaseUrl: string;

  constructor(
    private readonly assetsRepository: AssetsRepository,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly httpClient: HttpClientService,
  ) {
    this.morningstarBaseUrl = this.configService.get('morningstarBaseUrl', {
      infer: true,
    });
  }

  /**
   * Generate Morningstar X-Ray URL from portfolio assets
   * Note: Total weight validation is now handled by @HasTotalWeight100 decorator in DTO
   */
  async generate(dto: GenerateXRayDto): Promise<GenerateXRayResponse> {
    const holdings = await this.resolveXRayHoldings(dto.assets);

    return {
      morningstarUrl: this.formatMorningstarUrl(holdings),
      shareableUrl: this.formatShareableUrl(holdings),
    };
  }

  /**
   * Resolve Instant X-Ray F IDs, persist them, and keep weights aligned.
   */
  private async resolveXRayHoldings(assets: XRayAssetDto[]): Promise<
    Array<{
      tokenId: string;
      weight: number;
      typeCode: string;
      exchangeCode: string;
    }>
  > {
    const morningstarIds = assets.map((a) => a.morningstarId);
    const dbAssets =
      await this.assetsRepository.findManyByMorningstarIds(morningstarIds);

    const assetMap = this.indexAssetsByLookupId(dbAssets);

    const isinsNeedingSiblings = dbAssets
      .filter(
        (asset) =>
          isFundLikeType(asset.type) &&
          !isFundShareClassId(asset.shareClassId) &&
          isPerformanceId(asset.morningstarId) &&
          !extractPreferredFundId(asset.url) &&
          asset.isin,
      )
      .map((asset) => asset.isin as string);

    const siblingMap = new Map<string, Asset[]>();
    if (isinsNeedingSiblings.length > 0) {
      const siblings =
        await this.assetsRepository.findManyByIsins(isinsNeedingSiblings);
      for (const sibling of siblings) {
        if (!sibling.isin) continue;
        const key = sibling.isin.toUpperCase();
        const group = siblingMap.get(key) ?? [];
        group.push(sibling);
        siblingMap.set(key, group);
      }
    }

    const pageShareClassIds = await this.lookupShareClassIdsFromQuotePages(
      assets,
      assetMap,
      siblingMap,
    );
    await this.persistShareClassIds(assetMap, pageShareClassIds);

    return assets.map((asset) => {
      const dbAsset = assetMap.get(asset.morningstarId);
      const { typeCode, exchangeCode } = this.getAssetCodes(dbAsset);
      return {
        tokenId: this.resolveCanonicalTokenId(
          asset.morningstarId,
          dbAsset,
          siblingMap,
          pageShareClassIds,
        ),
        weight: asset.weight,
        typeCode,
        exchangeCode,
      };
    });
  }

  private formatMorningstarUrl(
    holdings: Array<{
      tokenId: string;
      weight: number;
      typeCode: string;
      exchangeCode: string;
    }>,
  ): string {
    const baseUrl = `${this.morningstarBaseUrl}${MORNINGSTAR_URL.XRAY_PATH}`;
    const securityTokens = holdings.map(
      (holding) =>
        `${holding.tokenId}]${holding.typeCode}]0]${holding.exchangeCode}${MORNINGSTAR_URL.SECURITY_TOKEN_SUFFIX}`,
    );
    const values = holdings.map((holding) =>
      Math.round(holding.weight * MORNINGSTAR_URL.WEIGHT_MULTIPLIER),
    );

    const url = new URL(baseUrl);
    url.searchParams.set('LanguageId', MORNINGSTAR_URL.LANGUAGE_ID);
    url.searchParams.set('PortfolioType', MORNINGSTAR_URL.PORTFOLIO_TYPE);
    url.searchParams.set('SecurityTokenList', securityTokens.join('|'));
    url.searchParams.set('values', values.join('|'));
    return url.toString();
  }

  /**
   * Get type code and exchange code for an asset
   * Uses centralized constants for Morningstar codes
   * @param dbAsset - Asset from database (if found)
   */
  private getAssetCodes(dbAsset: Asset | undefined): {
    typeCode: string;
    exchangeCode: string;
  } {
    const assetType = dbAsset?.type ?? null;
    return {
      typeCode: getMorningstarTypeCode(assetType),
      exchangeCode: getMorningstarExchangeCode(assetType),
    };
  }

  /**
   * Instant X-Ray needs F share-class IDs for funds/ETFs/ETCs.
   * Prefer the persisted shareClassId, then URL, ISIN sibling, or quote page HTML.
   */
  private resolveCanonicalTokenId(
    requestedId: string,
    dbAsset: Asset | undefined,
    siblingMap: Map<string, Asset[]>,
    pageShareClassIds: Map<string, string>,
  ): string {
    if (!dbAsset || !isFundLikeType(dbAsset.type)) {
      return requestedId;
    }
    if (isFundShareClassId(requestedId)) {
      return requestedId;
    }
    if (isFundShareClassId(dbAsset.shareClassId)) {
      return dbAsset.shareClassId!;
    }

    const fromUrl = extractPreferredFundId(dbAsset.url);
    if (fromUrl) {
      return fromUrl;
    }

    if (dbAsset.isin) {
      const preferred = pickPreferredFundAsset(
        siblingMap.get(dbAsset.isin.toUpperCase()) ?? [],
      );
      const siblingId =
        preferred &&
        (isFundShareClassId(preferred.shareClassId)
          ? preferred.shareClassId
          : isFundShareClassId(preferred.morningstarId)
            ? preferred.morningstarId
            : null);
      if (siblingId) {
        return siblingId;
      }
    }

    return pageShareClassIds.get(requestedId) ?? requestedId;
  }

  private indexAssetsByLookupId(dbAssets: Asset[]): Map<string, Asset> {
    const assetMap = new Map<string, Asset>();
    for (const asset of dbAssets) {
      assetMap.set(asset.morningstarId, asset);
      if (asset.shareClassId) {
        assetMap.set(asset.shareClassId, asset);
      }
    }
    return assetMap;
  }

  /**
   * Quote pages keep 0P in the URL; the F ID is in HTML (SAL attribute or JSON).
   */
  private async lookupShareClassIdsFromQuotePages(
    assets: XRayAssetDto[],
    assetMap: Map<string, Asset>,
    siblingMap: Map<string, Asset[]>,
  ): Promise<Map<string, string>> {
    const found = new Map<string, string>();
    const toFetch: Asset[] = [];

    for (const asset of assets) {
      const dbAsset = assetMap.get(asset.morningstarId);
      if (!dbAsset || !isFundLikeType(dbAsset.type)) continue;
      if (isFundShareClassId(asset.morningstarId)) continue;
      if (isFundShareClassId(dbAsset.shareClassId)) continue;
      if (extractPreferredFundId(dbAsset.url)) continue;
      if (dbAsset.isin) {
        const preferred = pickPreferredFundAsset(
          siblingMap.get(dbAsset.isin.toUpperCase()) ?? [],
        );
        if (
          preferred &&
          (isFundShareClassId(preferred.shareClassId) ||
            isFundShareClassId(preferred.morningstarId))
        ) {
          continue;
        }
      }
      toFetch.push(dbAsset);
    }

    if (toFetch.length === 0) {
      return found;
    }

    for (let i = 0; i < toFetch.length; i++) {
      const dbAsset = toFetch[i];
      const shareClassId = await this.fetchShareClassIdForAsset(dbAsset);
      if (shareClassId) {
        found.set(dbAsset.morningstarId, shareClassId);
      }
      if (i < toFetch.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, SHARE_CLASS_LOOKUP_GAP_MS),
        );
      }
    }

    return found;
  }

  private async persistShareClassIds(
    assetMap: Map<string, Asset>,
    pageShareClassIds: Map<string, string>,
  ): Promise<void> {
    const updates = [...pageShareClassIds.entries()].flatMap(
      ([requestedId, shareClassId]) => {
        const dbAsset = assetMap.get(requestedId);
        if (!dbAsset || dbAsset.shareClassId === shareClassId) {
          return [];
        }
        return [
          this.assetsRepository
            .update(dbAsset.id, { shareClassId })
            .then((updated) => {
              dbAsset.shareClassId = updated.shareClassId;
              this.logger.log(
                `[XRAY] Saved shareClassId ${shareClassId} for ${dbAsset.morningstarId}`,
              );
            })
            .catch((error) => {
              this.logger.warn(
                `[XRAY] Failed to save shareClassId ${shareClassId} for ${dbAsset.morningstarId}: ${error}`,
              );
            }),
        ];
      },
    );
    await Promise.all(updates);
  }

  private async fetchShareClassIdForAsset(
    dbAsset: Asset,
  ): Promise<string | null> {
    const urls = shareClassIdLookupUrls(
      dbAsset.morningstarId,
      dbAsset.url,
      this.toMsAssetType(dbAsset.type),
    );
    for (const url of urls) {
      const { shareClassId, blocked } =
        await this.fetchShareClassIdFromQuotePage(url);
      if (shareClassId) {
        return shareClassId;
      }
      if (blocked) {
        this.logger.warn(
          `[XRAY] Stopped share-class lookup for ${dbAsset.morningstarId} after bot challenge`,
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

  private async fetchShareClassIdFromQuotePage(
    url: string,
  ): Promise<{ shareClassId: string | null; blocked: boolean }> {
    try {
      const response = await this.httpClient.get<string>(url, {
        responseType: 'html',
        timeout: 15000,
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
          `[XRAY] Share-class ID from quote page ${url}: ${shareClassId}`,
        );
      }
      return { shareClassId, blocked: false };
    } catch (error) {
      this.logger.warn(
        `[XRAY] Failed to read share-class ID from ${url}: ${error}`,
      );
      return { shareClassId: null, blocked: false };
    }
  }

  /**
   * Shareable app URL uses Instant X-Ray token IDs (F… for funds when known)
   */
  private formatShareableUrl(
    holdings: Array<{ tokenId: string; weight: number }>,
  ): string {
    const assetsParam = holdings
      .map((holding) => `${holding.tokenId}:${holding.weight}`)
      .join(',');
    const defaultLocale = 'es';
    return `/${defaultLocale}/xray?assets=${encodeURIComponent(assetsParam)}`;
  }
}
