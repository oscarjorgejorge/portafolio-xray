import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateXRayDto, XRayAssetDto } from './dto';
import { AssetsRepository } from '../assets/assets.repository';
import type { AppConfig } from '../config';
import type { Asset } from '@prisma/client';
import { IXRayService } from './interfaces';
import { GenerateXRayResponse } from './types';
import {
  getMorningstarTypeCode,
  getMorningstarExchangeCode,
} from './constants';
import { MORNINGSTAR_URL } from '../common/constants';
import {
  extractPreferredFundId,
  isFundLikeType,
  isFundShareClassId,
  isPerformanceId,
  pickPreferredFundAsset,
} from '../assets/resolver/utils/canonical-fund-id';
import { createContextLogger } from '../common/logger';

@Injectable()
export class XRayService implements IXRayService {
  private readonly logger = createContextLogger(XRayService.name);
  private readonly morningstarBaseUrl: string;

  constructor(
    private readonly assetsRepository: AssetsRepository,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.morningstarBaseUrl = this.configService.get('morningstarBaseUrl', {
      infer: true,
    });
  }

  /**
   * Generate Morningstar X-Ray URL from cached portfolio assets.
   * Share-class F IDs are resolved at add time (and in background); this
   * method never scrapes Morningstar.
   */
  async generate(dto: GenerateXRayDto): Promise<GenerateXRayResponse> {
    const startedAt = Date.now();
    const holdings = await this.resolveXRayHoldings(dto.assets);
    const holdingsUsingFallback = holdings.filter(
      (holding) => holding.usedFallback,
    ).length;
    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `[XRAY] Generated URL for ${holdings.length} holdings in ${durationMs}ms ` +
        `(${holdingsUsingFallback} using 0P fallback)`,
    );

    return {
      morningstarUrl: this.formatMorningstarUrl(holdings),
      shareableUrl: this.formatShareableUrl(holdings),
      holdingsUsingFallback,
    };
  }

  /**
   * Resolve Instant X-Ray tokens from the database (shareClassId, URL, ISIN sibling).
   */
  private async resolveXRayHoldings(assets: XRayAssetDto[]): Promise<
    Array<{
      tokenId: string;
      weight: number;
      typeCode: string;
      exchangeCode: string;
      usedFallback: boolean;
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

    return assets.map((asset) => {
      const dbAsset = assetMap.get(asset.morningstarId);
      const { typeCode, exchangeCode } = this.getAssetCodes(dbAsset);
      const tokenId = this.resolveCanonicalTokenId(
        asset.morningstarId,
        dbAsset,
        siblingMap,
      );
      return {
        tokenId,
        weight: asset.weight,
        typeCode,
        exchangeCode,
        usedFallback: this.isUsingPerformanceFallback(
          asset.morningstarId,
          tokenId,
          dbAsset,
        ),
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
   * Prefer the persisted shareClassId, then URL, then ISIN sibling.
   */
  private resolveCanonicalTokenId(
    requestedId: string,
    dbAsset: Asset | undefined,
    siblingMap: Map<string, Asset[]>,
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

    return requestedId;
  }

  private isUsingPerformanceFallback(
    requestedId: string,
    tokenId: string,
    dbAsset: Asset | undefined,
  ): boolean {
    if (!isPerformanceId(tokenId)) {
      return false;
    }
    if (dbAsset && !isFundLikeType(dbAsset.type)) {
      return false;
    }
    return isPerformanceId(requestedId) || isPerformanceId(tokenId);
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
