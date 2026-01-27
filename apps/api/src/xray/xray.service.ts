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

@Injectable()
export class XRayService implements IXRayService {
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
   * Generate Morningstar X-Ray URL from portfolio assets
   * Note: Total weight validation is now handled by @HasTotalWeight100 decorator in DTO
   */
  async generate(dto: GenerateXRayDto): Promise<GenerateXRayResponse> {
    // Build Morningstar X-Ray URL
    const morningstarUrl = await this.buildMorningstarUrl(dto.assets);

    // Build shareable app URL
    const shareableUrl = this.buildShareableUrl(dto.assets);

    return {
      morningstarUrl,
      shareableUrl,
    };
  }

  /**
   * Build Morningstar X-Ray URL
   * Format: https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&PortfolioType=2&SecurityTokenList=...&values=...
   */
  private async buildMorningstarUrl(assets: XRayAssetDto[]): Promise<string> {
    const baseUrl = `${this.morningstarBaseUrl}${MORNINGSTAR_URL.XRAY_PATH}`;

    // Batch lookup: single query instead of N queries
    const morningstarIds = assets.map((a) => a.morningstarId);
    const dbAssets =
      await this.assetsRepository.findManyByMorningstarIds(morningstarIds);

    // Create a map for O(1) lookups
    const assetMap = new Map(dbAssets.map((a) => [a.morningstarId, a]));

    const securityTokens: string[] = [];
    const values: number[] = [];

    for (const asset of assets) {
      const dbAsset = assetMap.get(asset.morningstarId);

      // Determine type code and exchange code
      const { typeCode, exchangeCode } = this.getAssetCodes(dbAsset);

      // Generate security token: {ID}]typeCode]0]{EXCHANGE}$$ALL_1340
      // Note: Do NOT pre-encode tokens - URLSearchParams handles encoding automatically
      const securityToken = `${asset.morningstarId}]${typeCode}]0]${exchangeCode}${MORNINGSTAR_URL.SECURITY_TOKEN_SUFFIX}`;
      securityTokens.push(securityToken);

      // Convert weight percentage to basis points (multiply by 100)
      values.push(Math.round(asset.weight * MORNINGSTAR_URL.WEIGHT_MULTIPLIER));
    }

    // Build URL with all parameters
    // URLSearchParams automatically encodes values, so use raw | separator
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
   * Build shareable app URL with portfolio encoded in query params
   * Format: /xray?assets=ISIN:weight,ISIN:weight
   */
  private buildShareableUrl(assets: XRayAssetDto[]): string {
    // For now, use Morningstar IDs in the shareable URL
    // In the frontend, this will be expanded to include ISINs
    const assetsParam = assets
      .map((asset) => `${asset.morningstarId}:${asset.weight}`)
      .join(',');

    // Return relative URL - frontend will handle full URL
    return `/xray?assets=${encodeURIComponent(assetsParam)}`;
  }

  /**
   * Parse shareable URL back to assets array
   */
  parseShareableUrl(assetsParam: string): XRayAssetDto[] {
    const assets: XRayAssetDto[] = [];

    const pairs = decodeURIComponent(assetsParam).split(',');
    for (const pair of pairs) {
      const [morningstarId, weightStr] = pair.split(':');
      const weight = parseFloat(weightStr);

      if (morningstarId && !isNaN(weight)) {
        assets.push({ morningstarId, weight });
      }
    }

    return assets;
  }
}
