import { GenerateXRayDto, XRayAssetDto } from '../dto';
import { GenerateXRayResponse } from '../types';

/**
 * X-Ray Service Interface
 * Defines the contract for portfolio X-Ray operations
 */
export interface IXRayService {
  /**
   * Generate Morningstar X-Ray URL from portfolio assets
   * @param dto - Portfolio assets with their weights
   * @throws BadRequestException if total weight doesn't equal 100%
   */
  generate(dto: GenerateXRayDto): Promise<GenerateXRayResponse>;

  /**
   * Parse shareable URL back to assets array
   * @param assetsParam - Encoded assets parameter from URL
   */
  parseShareableUrl(assetsParam: string): XRayAssetDto[];
}

/**
 * Injection token for IXRayService
 */
export const XRAY_SERVICE = Symbol('XRAY_SERVICE');
