import { apiClient } from './client';
import { API } from '@/lib/constants';
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
 * Quote/performance Morningstar ID. Generate revalidates F IDs on the server
 * so a stale shareClassId cannot reach Instant X-Ray.
 */
export function toXRayTokenId(asset: {
  morningstarId: string;
  shareClassId?: string | null;
}): string {
  return asset.morningstarId;
}

/**
 * Generate Morningstar X-Ray URL from portfolio assets
 * Validates response against Zod schema
 */
export async function generateXRay(
  assets: XRayAsset[]
): Promise<GenerateXRayResponse> {
  const response = await apiClient.post<GenerateXRayResponse>(
    '/xray/generate',
    { assets },
    { timeout: API.GENERATE_TIMEOUT_MS }
  );

  return GenerateXRayResponseSchema.parse(response.data);
}
