import { apiClient } from './client';
import {
  AssetSchema,
  ResolveAssetResponseSchema,
  type Asset,
  type AssetType,
  type AlternativeAsset,
  type ResolveAssetResponse,
} from './schemas';

// Re-export types from schemas for backward compatibility
export type { Asset, AssetType, AlternativeAsset, ResolveAssetResponse };

export interface ConfirmAssetRequest {
  isin?: string | null;
  morningstarId: string;
  name: string;
  type: AssetType;
  url: string;
  ticker?: string;
}

/** Options for API requests */
export interface RequestOptions {
  signal?: AbortSignal;
}

/**
 * Resolve an asset identifier (ISIN, Morningstar ID, or ticker) to asset details
 * Validates response against Zod schema
 */
export async function resolveAsset(
  input: string,
  assetType?: AssetType,
  options?: RequestOptions
): Promise<ResolveAssetResponse> {
  const response = await apiClient.post<{ success: true; data: ResolveAssetResponse; timestamp: string; requestId?: string }>(
    '/assets/resolve',
    { input, assetType },
    { signal: options?.signal }
  );
  // The TransformResponseInterceptor wraps responses in { success: true, data: {...}, timestamp, requestId }
  // So we need to access response.data.data to get the actual ResolveAssetResponse
  const wrappedData = response.data.data;
  
  // Validate the response structure
  if (!wrappedData) {
    throw new Error('Invalid API response: data.data is undefined');
  }
  
  return ResolveAssetResponseSchema.parse(wrappedData);
}

/**
 * Manually confirm and save an asset to the cache
 * Validates response against Zod schema
 */
export async function confirmAsset(
  data: ConfirmAssetRequest
): Promise<Asset> {
  const response = await apiClient.post<{ success: true; data: Asset; timestamp: string; requestId?: string }>('/assets/confirm', data);
  // TransformResponseInterceptor wraps the response in { success: true, data: {...}, timestamp, requestId }
  return AssetSchema.parse(response.data.data);
}

/**
 * Get cached asset by ID
 * Validates response against Zod schema
 */
export async function getAssetById(id: string): Promise<Asset> {
  const response = await apiClient.get<{ success: true; data: Asset; timestamp: string; requestId?: string }>(`/assets/${id}`);
  // TransformResponseInterceptor wraps the response in { success: true, data: {...}, timestamp, requestId }
  return AssetSchema.parse(response.data.data);
}

/**
 * Update ISIN for an existing asset
 * Validates response against Zod schema
 */
export async function updateAssetIsin(id: string, isin: string): Promise<Asset> {
  const response = await apiClient.patch<{ success: true; data: Asset; timestamp: string; requestId?: string }>(`/assets/${id}/isin`, { isin });
  // TransformResponseInterceptor wraps the response in { success: true, data: {...}, timestamp, requestId }
  return AssetSchema.parse(response.data.data);
}

