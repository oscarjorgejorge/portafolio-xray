import { apiClient } from './client';
import type { PortfolioHoldingView } from '@/lib/portfolio-seo';

const BATCH_SIZE = 20;
const BATCH_TIMEOUT_MS = 8000;

interface ResolvedAssetFields {
  name?: string;
  ticker?: string | null;
  isin?: string | null;
  type?: string | null;
}

interface BatchResolveData {
  results?: Array<{
    input: string;
    result?: {
      asset?: ResolvedAssetFields;
    };
  }>;
}

export interface PortfolioAssetRef {
  morningstarId: string;
  weight: number;
}

/**
 * Resolve holding names from the asset cache.
 * Chunks stay within the API batch limit. A failed chunk keeps the
 * Morningstar id so the server HTML still lists every holding.
 */
export async function resolvePortfolioHoldings(
  assets: PortfolioAssetRef[],
): Promise<PortfolioHoldingView[]> {
  const sorted = [...assets].sort((a, b) => b.weight - a.weight);
  const resolved = new Map<string, ResolvedAssetFields>();

  for (let index = 0; index < sorted.length; index += BATCH_SIZE) {
    const chunk = sorted.slice(index, index + BATCH_SIZE);

    try {
      const response = await apiClient.post<BatchResolveData>(
        '/assets/resolve/batch',
        {
          assets: chunk.map((asset) => ({ input: asset.morningstarId })),
        },
        { timeout: BATCH_TIMEOUT_MS },
      );

      for (const item of response.data?.results ?? []) {
        if (item.input && item.result?.asset) {
          resolved.set(item.input.toUpperCase(), item.result.asset);
        }
      }
    } catch {
      // Leave this chunk on the identifier fallback.
    }
  }

  return sorted.map((asset) => {
    const match = resolved.get(asset.morningstarId.toUpperCase());
    const name = match?.name?.trim() || asset.morningstarId;

    return {
      morningstarId: asset.morningstarId,
      weight: asset.weight,
      name,
      ticker: match?.ticker?.trim() || null,
      isin: match?.isin?.trim() || null,
      type: match?.type?.trim() || null,
    };
  });
}
