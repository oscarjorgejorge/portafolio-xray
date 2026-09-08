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

const FUND_SHARE_CLASS_ID_PATTERN = /^F0[A-Z0-9]{8,12}$/i;

/**
 * Prefer the Instant X-Ray F ID when the resolved asset already has one.
 */
export function toXRayTokenId(asset: {
  morningstarId: string;
  shareClassId?: string | null;
}): string {
  const shareClassId = asset.shareClassId?.trim();
  if (shareClassId && FUND_SHARE_CLASS_ID_PATTERN.test(shareClassId)) {
    return shareClassId.toUpperCase();
  }
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
