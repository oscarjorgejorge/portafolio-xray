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
  isin: string;
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
  const response = await apiClient.post(
    '/assets/resolve',
    { input, assetType },
    { signal: options?.signal }
  );
  return ResolveAssetResponseSchema.parse(response.data);
}

/**
 * Manually confirm and save an asset to the cache
 * Validates response against Zod schema
 */
export async function confirmAsset(
  data: ConfirmAssetRequest
): Promise<Asset> {
  const response = await apiClient.post('/assets/confirm', data);
  return AssetSchema.parse(response.data);
}

/**
 * Get cached asset by ID
 * Validates response against Zod schema
 */
export async function getAssetById(id: string): Promise<Asset> {
  const response = await apiClient.get(`/assets/${id}`);
  return AssetSchema.parse(response.data);
}

/**
 * Update ISIN for an existing asset
 * Validates response against Zod schema
 */
export async function updateAssetIsin(id: string, isin: string): Promise<Asset> {
  const response = await apiClient.patch(`/assets/${id}/isin`, { isin });
  return AssetSchema.parse(response.data);
}

