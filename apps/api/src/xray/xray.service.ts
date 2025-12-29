import { Injectable, BadRequestException } from '@nestjs/common';
import { GenerateXRayDto, XRayAssetDto } from './dto';

export interface GenerateXRayResponse {
  morningstarUrl: string;
  shareableUrl: string;
}

@Injectable()
export class XRayService {
  private readonly MORNINGSTAR_BASE_URL =
    process.env.MORNINGSTAR_BASE_URL || 'https://lt.morningstar.com';

  /**
   * Generate Morningstar X-Ray URL from portfolio assets
   */
  generate(dto: GenerateXRayDto): GenerateXRayResponse {
    // Validate total weight equals 100%
    const totalWeight = dto.assets.reduce((sum, asset) => sum + asset.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new BadRequestException(
        `Total weight must equal 100%. Current total: ${totalWeight.toFixed(2)}%`,
      );
    }

    // Build Morningstar X-Ray URL
    const morningstarUrl = this.buildMorningstarUrl(dto.assets);

    // Build shareable app URL
    const shareableUrl = this.buildShareableUrl(dto.assets);

    return {
      morningstarUrl,
      shareableUrl,
    };
  }

  /**
   * Build Morningstar X-Ray URL
   * Format: https://lt.morningstar.com/j2uwuwirpv/xray/default.aspx?PortfolioType=2&values=ID1|weight1|ID2|weight2...
   */
  private buildMorningstarUrl(assets: XRayAssetDto[]): string {
    // Build values string: ID1|weight1|ID2|weight2...
    const values = assets
      .map((asset) => `${asset.morningstarId}|${asset.weight}`)
      .join('|');

    // Note: The exact URL format may need adjustment based on Morningstar's actual API
    // This is a common pattern but may require refinement
    const url = new URL(
      '/j2uwuwirpv/xray/default.aspx',
      this.MORNINGSTAR_BASE_URL,
    );
    url.searchParams.set('PortfolioType', '2');
    url.searchParams.set('values', values);

    return url.toString();
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

