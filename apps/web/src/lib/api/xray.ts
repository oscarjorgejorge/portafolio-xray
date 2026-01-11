import { apiClient } from './client';

export interface XRayAsset {
  morningstarId: string;
  weight: number;
}

export interface GenerateXRayRequest {
  assets: XRayAsset[];
}

export interface GenerateXRayResponse {
  morningstarUrl: string;
  shareableUrl: string;
}

/**
 * Generate Morningstar X-Ray URL from portfolio assets
 */
export async function generateXRay(
  assets: XRayAsset[]
): Promise<GenerateXRayResponse> {
  const response = await apiClient.post<GenerateXRayResponse>(
    '/xray/generate',
    { assets }
  );
  return response.data;
}

