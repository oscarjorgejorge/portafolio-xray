import { vi } from 'vitest';
import type { ResolveAssetResponse, Asset } from '@/lib/api/schemas';
import { createMockAsset } from '@/test/fixtures';

/**
 * Mock successful asset resolution response
 */
export function createResolveSuccessResponse(
  overrides: Partial<Asset> = {}
): ResolveAssetResponse {
  return {
    success: true,
    source: 'resolved',
    asset: createMockAsset(overrides),
  };
}

/**
 * Mock response with alternatives (low confidence)
 */
export function createAlternativesResponse(): ResolveAssetResponse {
  return {
    success: false,
    source: 'manual_required',
    alternatives: [
      {
        morningstarId: 'F00000WU13',
        name: 'Vanguard FTSE All-World ETF',
        url: 'https://morningstar.com/etf/1',
        score: 0.85,
      },
      {
        morningstarId: 'F00000WU14',
        name: 'Similar Fund',
        url: 'https://morningstar.com/etf/2',
        score: 0.75,
      },
    ],
    error: 'Multiple matches found',
  };
}

/**
 * Mock response for asset not found
 */
export function createNotFoundResponse(): ResolveAssetResponse {
  return {
    success: false,
    source: 'manual_required',
    error: 'Asset not found',
  };
}

/**
 * Create mock for resolveAsset API function
 */
export function createResolveAssetMock() {
  return vi.fn();
}
