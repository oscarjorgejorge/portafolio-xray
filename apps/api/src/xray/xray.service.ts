import { Injectable, BadRequestException } from '@nestjs/common';
import { GenerateXRayDto, XRayAssetDto } from './dto';
import { AssetsRepository } from '../assets/assets.repository';

export interface GenerateXRayResponse {
  morningstarUrl: string;
  shareableUrl: string;
}

@Injectable()
export class XRayService {
  private readonly MORNINGSTAR_BASE_URL =
    process.env.MORNINGSTAR_BASE_URL || 'https://lt.morningstar.com';

  constructor(private readonly assetsRepository: AssetsRepository) {}

  /**
   * Generate Morningstar X-Ray URL from portfolio assets
   */
  async generate(dto: GenerateXRayDto): Promise<GenerateXRayResponse> {
    // Validate total weight equals 100%
    const totalWeight = dto.assets.reduce((sum, asset) => sum + asset.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new BadRequestException(
        `Total weight must equal 100%. Current total: ${totalWeight.toFixed(2)}%`,
      );
    }

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
    const baseUrl = `${this.MORNINGSTAR_BASE_URL}/j2uwuwirpv/xraypdf/default.aspx`;
    
    // Look up asset types from database
    const securityTokens: string[] = [];
    const values: number[] = [];

    for (const asset of assets) {
      // Look up asset type from database
      const dbAsset = await this.assetsRepository.findByMorningstarId(asset.morningstarId);
      
      // Determine type code and exchange code
      let typeCode: string;
      let exchangeCode: string;
      
      if (dbAsset) {
        // Use type from database
        if (dbAsset.type === 'STOCK') {
          typeCode = '3';
          exchangeCode = 'E0WWE';
        } else {
          // FUND, ETF, ETC all use type code 2
          typeCode = '2';
          exchangeCode = 'FOESP';
        }
      } else {
        // Fallback: infer from Morningstar ID format
        // IDs starting with F are funds, 0P could be anything but default to fund
        if (asset.morningstarId.toUpperCase().startsWith('F')) {
          typeCode = '2';
          exchangeCode = 'FOESP';
        } else {
          // Default to fund for unknown types
          typeCode = '2';
          exchangeCode = 'FOESP';
        }
      }

      // Generate security token: {ID}]typeCode]0]{EXCHANGE}$$ALL_1340
      const securityToken = `${asset.morningstarId}]${typeCode}]0]${exchangeCode}$$ALL_1340`;
      securityTokens.push(encodeURIComponent(securityToken));
      
      // Convert weight percentage to absolute value (multiply by 100)
      values.push(Math.round(asset.weight * 100));
    }

    // Build URL with all parameters
    const url = new URL(baseUrl);
    url.searchParams.set('LanguageId', 'es-ES');
    url.searchParams.set('PortfolioType', '2');
    url.searchParams.set('SecurityTokenList', securityTokens.join('%7C')); // %7C is |
    url.searchParams.set('values', values.join('%7C'));

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

