import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateXRayDto, XRayAssetDto } from './dto';
import { AssetsRepository } from '../assets/assets.repository';
import { ShareClassLookupService } from '../assets/share-class-lookup.service';
import type { AppConfig } from '../config';
import type { Asset } from '@prisma/client';
import { IXRayService } from './interfaces';
import { GenerateXRayResponse } from './types';
import {
  getMorningstarTypeId,
  MORNINGSTAR_SECURITY_TOKEN,
  MORNINGSTAR_TYPE_IDS,
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

const SCREENER_REMAP_CONCURRENCY = 4;

type XRayHolding = {
  tokenId: string;
  weight: number;
  /** Instant X-Ray short-format typeid (FO / ST) */
  typeId: string;
  usedFallback: boolean;
  /** True when Instant X-Ray token is a sibling-class F ID (not verified for this ISIN). */
  usedRelatedShareClass: boolean;
  assetId?: string;
  lookup?: {
    morningstarId: string;
    isin?: string | null;
    url?: string | null;
    name?: string | null;
  };
};

@Injectable()
export class XRayService implements IXRayService {
  private readonly logger = createContextLogger(XRayService.name);
  private readonly morningstarBaseUrl: string;

  constructor(
    private readonly assetsRepository: AssetsRepository,
    private readonly shareClassLookup: ShareClassLookupService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {
    this.morningstarBaseUrl = this.configService.get('morningstarBaseUrl', {
      infer: true,
    });
  }

  /**
   * Generate Morningstar X-Ray URL from cached portfolio assets.
   * Missing F IDs are filled from the Instant X-Ray screener (JSON), never
   * from quote-page HTML, so generate stays well under the client timeout.
   */
  async generate(dto: GenerateXRayDto): Promise<GenerateXRayResponse> {
    const startedAt = Date.now();
    const holdings = await this.resolveXRayHoldings(dto.assets);
    await this.fillMissingShareClassIds(holdings);
    const holdingsUsingFallback = holdings.filter(
      (holding) => holding.usedFallback,
    ).length;
    const holdingsUsingRelatedShareClass = holdings.filter(
      (holding) => holding.usedRelatedShareClass,
    ).length;
    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `[XRAY] Generated URL for ${holdings.length} holdings in ${durationMs}ms ` +
        `(${holdingsUsingFallback} using 0P fallback` +
        (holdingsUsingRelatedShareClass > 0
          ? `, ${holdingsUsingRelatedShareClass} using related-class F`
          : '') +
        `)`,
    );

    return {
      morningstarUrl: this.formatMorningstarUrl(holdings),
      shareableUrl: this.formatShareableUrl(holdings),
      holdingsUsingFallback,
      holdingsUsingRelatedShareClass,
    };
  }

  /**
   * Resolve Instant X-Ray tokens from the database (shareClassId, URL, ISIN sibling).
   */
  private async resolveXRayHoldings(
    assets: XRayAssetDto[],
  ): Promise<XRayHolding[]> {
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
      const tokenId = this.resolveCanonicalTokenId(
        asset.morningstarId,
        dbAsset,
        siblingMap,
      );
      return {
        tokenId,
        weight: asset.weight,
        typeId: getMorningstarTypeId(dbAsset?.type ?? null),
        usedFallback: this.isUsingPerformanceFallback(
          asset.morningstarId,
          tokenId,
          dbAsset,
        ),
        usedRelatedShareClass: false,
        assetId: dbAsset?.id,
        lookup: {
          morningstarId: dbAsset?.morningstarId ?? asset.morningstarId,
          isin: dbAsset?.isin,
          url: dbAsset?.url,
          name: dbAsset?.name,
        },
      };
    });
  }

  /**
   * Instant X-Ray blank rows are 0P tokens. Unverified F IDs are also
   * re-resolved from the screener so a stale mapping cannot reach the PDF.
   * Sibling-class F IDs (proxy) may be used in the URL but are never persisted
   * as shareClassVerified for a different ISIN.
   */
  private async fillMissingShareClassIds(
    holdings: XRayHolding[],
  ): Promise<void> {
    const missing = holdings.filter(
      (holding) => holding.usedFallback && holding.lookup,
    );
    if (missing.length === 0) {
      return;
    }

    await this.runPool(missing, SCREENER_REMAP_CONCURRENCY, async (holding) => {
      const identity = await this.shareClassLookup.lookupIdentityFromScreener(
        holding.lookup!,
      );
      const ownId = identity.shareClassId;
      const proxyId = identity.proxyShareClassId;
      const tokenId = ownId ?? proxyId ?? null;
      if (!tokenId) {
        return;
      }
      holding.tokenId = tokenId;
      holding.usedFallback = false;
      holding.usedRelatedShareClass = !ownId && Boolean(proxyId);

      if (!ownId || !holding.assetId) {
        return;
      }
      const assigned = await this.assetsRepository.tryAssignShareClassId(
        holding.assetId,
        ownId,
        { verified: true },
      );
      if (!assigned) {
        this.logger.debug(
          `[XRAY] shareClassId ${ownId} already owned; token still used for ${holding.lookup?.morningstarId}`,
        );
      }
    });
  }

  private async runPool<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    const queue = [...items];
    const size = Math.min(limit, queue.length);
    await Promise.all(
      Array.from({ length: size }, async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) {
            await worker(item);
          }
        }
      }),
    );
  }

  /**
   * Fund-only portfolios keep the short Instant X-Ray URL.
   * Any stock switches the whole portfolio to SecurityTokenList.
   * The client posts that token so the query string stays under the IIS limit.
   */
  private formatMorningstarUrl(
    holdings: Array<{
      tokenId: string;
      weight: number;
      typeId: string;
    }>,
  ): string {
    const hasStock = holdings.some(
      (holding) => holding.typeId === MORNINGSTAR_TYPE_IDS.STOCK,
    );
    if (hasStock) {
      return this.formatSecurityTokenListUrl(holdings);
    }
    return this.formatShortUrl(holdings);
  }

  /**
   * Compact Instant X-Ray PDF URL (securityIds / marketValues / typeids).
   * Funds, ETFs and ETCs resolve with typeid FO.
   */
  private formatShortUrl(
    holdings: Array<{
      tokenId: string;
      weight: number;
      typeId: string;
    }>,
  ): string {
    const baseUrl = `${this.morningstarBaseUrl}${MORNINGSTAR_URL.XRAY_PATH}`;
    const securityIds = holdings.map((holding) => holding.tokenId).join('|');
    const marketValues = holdings
      .map((holding) =>
        Math.round(holding.weight * MORNINGSTAR_URL.WEIGHT_MULTIPLIER),
      )
      .join('|');
    const typeids = holdings.map((holding) => holding.typeId).join('|');

    const url = new URL(baseUrl);
    url.searchParams.set('LanguageId', MORNINGSTAR_URL.LANGUAGE_ID);
    url.searchParams.set('CurrencyId', MORNINGSTAR_URL.CURRENCY_ID);
    // Trailing | matches Instant X-Ray / Rankia short-format URLs that work in production.
    url.searchParams.set('securityIds', `${securityIds}|`);
    url.searchParams.set('marketValues', `${marketValues}|`);
    url.searchParams.set('typeids', `${typeids}|`);
    return url.toString();
  }

  /**
   * Full token: {id}]2]0]FOESP$$ALL_1340 for funds, {id}]3]0]E0WWE$$ALL_1340 for stocks.
   */
  private formatSecurityTokenListUrl(
    holdings: Array<{
      tokenId: string;
      weight: number;
      typeId: string;
    }>,
  ): string {
    const baseUrl = `${this.morningstarBaseUrl}${MORNINGSTAR_URL.XRAY_PATH}`;
    const securityTokenList = holdings
      .map((holding) => {
        const stock = holding.typeId === MORNINGSTAR_TYPE_IDS.STOCK;
        const typeCode = stock
          ? MORNINGSTAR_SECURITY_TOKEN.STOCK_TYPE
          : MORNINGSTAR_SECURITY_TOKEN.FUND_TYPE;
        const exchange = stock
          ? MORNINGSTAR_SECURITY_TOKEN.STOCK_EXCHANGE
          : MORNINGSTAR_SECURITY_TOKEN.FUND_EXCHANGE;
        return `${holding.tokenId}]${typeCode}]0]${exchange}${MORNINGSTAR_SECURITY_TOKEN.SUFFIX}`;
      })
      .join('|');
    const values = holdings
      .map((holding) =>
        Math.round(holding.weight * MORNINGSTAR_URL.WEIGHT_MULTIPLIER),
      )
      .join('|');

    const url = new URL(baseUrl);
    url.searchParams.set('LanguageId', MORNINGSTAR_URL.LANGUAGE_ID);
    url.searchParams.set(
      'PortfolioType',
      MORNINGSTAR_SECURITY_TOKEN.PORTFOLIO_TYPE,
    );
    url.searchParams.set('SecurityTokenList', securityTokenList);
    url.searchParams.set('values', values);
    return url.toString();
  }

  /**
   * Instant X-Ray needs F share-class IDs for funds/ETFs/ETCs.
   * Only a screener-verified shareClassId is safe to send to the PDF.
   */
  private resolveCanonicalTokenId(
    requestedId: string,
    dbAsset: Asset | undefined,
    siblingMap: Map<string, Asset[]>,
  ): string {
    if (!dbAsset || !isFundLikeType(dbAsset.type)) {
      return requestedId;
    }

    if (
      dbAsset.shareClassVerified &&
      isFundShareClassId(dbAsset.shareClassId)
    ) {
      return dbAsset.shareClassId!;
    }

    if (dbAsset.isin) {
      const preferred = pickPreferredFundAsset(
        siblingMap.get(dbAsset.isin.toUpperCase()) ?? [],
      );
      if (
        preferred?.shareClassVerified &&
        isFundShareClassId(preferred.shareClassId)
      ) {
        return preferred.shareClassId!;
      }
      if (
        preferred?.shareClassVerified &&
        isFundShareClassId(preferred.morningstarId)
      ) {
        return preferred.morningstarId;
      }
    }

    return isPerformanceId(dbAsset.morningstarId)
      ? dbAsset.morningstarId
      : requestedId;
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
