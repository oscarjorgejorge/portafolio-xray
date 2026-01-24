import { apiClient } from './client';

export type AssetType = 'ETF' | 'FUND' | 'STOCK' | 'ETC';

export interface Asset {
  id: string;
  isin: string;
  morningstarId: string;
  ticker?: string | null;
  name: string;
  type: AssetType;
  url: string;
  source: 'manual' | 'web_search' | 'imported';
  createdAt: string;
  updatedAt: string;
}

export interface AlternativeAsset {
  morningstarId: string;
  name: string;
  url: string;
  score: number;
}

export interface ResolveAssetResponse {
  success: boolean;
  source: 'cache' | 'resolved' | 'manual_required';
  asset?: Asset;
  alternatives?: AlternativeAsset[];
  error?: string;
}

export interface ConfirmAssetRequest {
  isin: string;
  morningstarId: string;
  name: string;
  type: AssetType;
  url: string;
  ticker?: string;
}

/**
 * Resolve an asset identifier (ISIN, Morningstar ID, or ticker) to asset details
 */
export async function resolveAsset(
  input: string,
  assetType?: AssetType
): Promise<ResolveAssetResponse> {
  const response = await apiClient.post<ResolveAssetResponse>('/assets/resolve', {
    input,
    assetType,
  });
  return response.data;
}

/**
 * Manually confirm and save an asset to the cache
 */
export async function confirmAsset(
  data: ConfirmAssetRequest
): Promise<Asset> {
  const response = await apiClient.post<Asset>('/assets/confirm', data);
  return response.data;
}

/**
 * Get cached asset by ID
 */
export async function getAssetById(id: string): Promise<Asset> {
  const response = await apiClient.get<Asset>(`/assets/${id}`);
  return response.data;
}

