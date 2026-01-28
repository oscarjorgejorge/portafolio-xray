import { z } from 'zod';

// ============================================
// Asset Schemas
// ============================================

export const AssetTypeSchema = z.enum(['ETF', 'FUND', 'STOCK', 'ETC']);

export const AssetSchema = z.object({
  id: z.string(),
  isin: z.string().nullable(),
  morningstarId: z.string(),
  ticker: z.string().nullable().optional(),
  name: z.string(),
  type: AssetTypeSchema,
  url: z.string(),
  source: z.enum(['manual', 'web_search', 'imported']),
  isinPending: z.boolean().optional(),
  isinManual: z.boolean().optional(),
  tickerManual: z.boolean().optional(),
  // Note: createdAt/updatedAt are intentionally excluded from API responses
  // by the backend mapper to avoid exposing internal database fields
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const AlternativeAssetSchema = z.object({
  morningstarId: z.string(),
  name: z.string(),
  url: z.string(),
  score: z.number(),
  ticker: z.string().optional(),
});

// ============================================
// Resolve Asset Response
// ============================================

export const ResolveAssetResponseSchema = z.object({
  success: z.boolean(),
  source: z.enum(['cache', 'resolved', 'manual_required']),
  asset: AssetSchema.optional(),
  isinPending: z.boolean().optional(),
  alternatives: z.array(AlternativeAssetSchema).optional(),
  error: z.string().optional(),
});

// ============================================
// X-Ray Schemas
// ============================================

export const GenerateXRayResponseSchema = z.object({
  morningstarUrl: z.string(),
  shareableUrl: z.string(),
});

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type AssetType = z.infer<typeof AssetTypeSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type AlternativeAsset = z.infer<typeof AlternativeAssetSchema>;
export type ResolveAssetResponse = z.infer<typeof ResolveAssetResponseSchema>;
export type GenerateXRayResponse = z.infer<typeof GenerateXRayResponseSchema>;
