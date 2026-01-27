import { apiClient } from './client';
import {
  GenerateXRayResponseSchema,
  type GenerateXRayResponse,
} from './schemas';

export interface XRayAsset {
  morningstarId: string;
  weight: number;
}

export interface GenerateXRayRequest {
  assets: XRayAsset[];
}

// Re-export type for backward compatibility
export type { GenerateXRayResponse };

/**
 * Generate Morningstar X-Ray URL from portfolio assets
 * Validates response against Zod schema
 */
export async function generateXRay(
  assets: XRayAsset[]
): Promise<GenerateXRayResponse> {
  const response = await apiClient.post('/xray/generate', { assets });
  return GenerateXRayResponseSchema.parse(response.data);
}

