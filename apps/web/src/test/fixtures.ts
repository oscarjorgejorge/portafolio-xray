import type { PortfolioAsset, Asset, AssetType } from '@/types';

/**
 * Factory function to create a mock Asset
 */
export function createMockAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    isin: 'IE00B4L5Y983',
    morningstarId: 'F00000WU13',
    ticker: 'VWCE',
    name: 'Vanguard FTSE All-World UCITS ETF',
    type: 'ETF' as AssetType,
    url: 'https://morningstar.com/etf/VWCE',
    source: 'web_search',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Factory function to create a mock PortfolioAsset
 */
export function createMockPortfolioAsset(
  overrides: Partial<PortfolioAsset> = {}
): PortfolioAsset {
  return {
    id: 'portfolio-asset-1',
    identifier: 'IE00B4L5Y983',
    weight: 50,
    status: 'resolved',
    asset: createMockAsset(),
    ...overrides,
  };
}

/**
 * Create multiple mock portfolio assets for testing
 */
export function createMockPortfolioAssets(count: number): PortfolioAsset[] {
  return Array.from({ length: count }, (_, i) =>
    createMockPortfolioAsset({
      id: `portfolio-asset-${i + 1}`,
      identifier: `ISIN${i + 1}000000000`.slice(0, 12),
      weight: Math.floor(100 / count),
      asset: createMockAsset({
        id: `asset-${i + 1}`,
        isin: `ISIN${i + 1}000000000`.slice(0, 12),
        morningstarId: `F0000${i + 1}WU13`,
        name: `Asset ${i + 1}`,
      }),
    })
  );
}

/**
 * Create a resolved portfolio asset
 */
export function createResolvedAsset(
  overrides: Partial<PortfolioAsset> = {}
): PortfolioAsset {
  return createMockPortfolioAsset({
    status: 'resolved',
    ...overrides,
  });
}

/**
 * Create a pending portfolio asset (not yet resolved)
 */
export function createPendingAsset(
  overrides: Partial<PortfolioAsset> = {}
): PortfolioAsset {
  return {
    id: 'pending-asset',
    identifier: 'PENDING123456',
    weight: 0,
    status: 'pending',
    asset: undefined,
    ...overrides,
  };
}
