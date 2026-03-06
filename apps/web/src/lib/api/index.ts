/**
 * API Layer - Barrel exports
 *
 * This file centralizes all API-related exports for cleaner imports.
 *
 * Usage:
 * import { resolveAsset, generateXRay, queryKeys, ApiError } from '@/lib/api';
 */

// API Client
export { apiClient, ApiError } from './client';

// Assets API
export {
  resolveAsset,
  confirmAsset,
  getAssetById,
  updateAssetIsin,
  type ConfirmAssetRequest,
  type RequestOptions,
} from './assets';

// X-Ray API
export { generateXRay, type XRayAsset, type GenerateXRayRequest } from './xray';

// Portfolios API
export {
  createPortfolio,
  getPortfolios,
  getPortfolio,
  getPublicPortfolios,
  getPublicPortfolio,
  deletePortfolio,
  type CreatePortfolioRequest,
  type PortfolioListItem,
  type PortfolioAsset,
  type PublicPortfolioListItem,
} from './portfolios';

// Query Keys
export { queryKeys, type QueryKeys } from './queryKeys';

// Schemas & Types
export {
  // Schemas
  AssetSchema,
  AssetTypeSchema,
  AlternativeAssetSchema,
  ResolveAssetResponseSchema,
  GenerateXRayResponseSchema,
  // Types
  type Asset,
  type AssetType,
  type AlternativeAsset,
  type ResolveAssetResponse,
  type GenerateXRayResponse,
} from './schemas';
