import { unstable_cache } from 'next/cache';
import { apiClient } from './client';
import type { PortfolioHoldingView } from '@/lib/portfolio-seo';

const BATCH_SIZE = 20;
const BATCH_TIMEOUT_MS = 8000;
const ASSET_RESOLVE_REVALIDATE_SECONDS = 60 * 60 * 24;
/**
 * Cache misses for one page arrive as separate unstable_cache calls.
 * Hold the batch open briefly so those misses share one request per 20 ids.
 */
const BATCH_COALESCE_MS = 20;

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

interface PendingBatch {
  ids: string[];
  waiters: Map<string, Array<(value: ResolvedAssetFields | null) => void>>;
  timer: ReturnType<typeof setTimeout> | null;
}

let pendingBatch: PendingBatch | null = null;

async function fetchResolveBatch(
  ids: string[],
): Promise<Map<string, ResolvedAssetFields>> {
  const resolved = new Map<string, ResolvedAssetFields>();
  if (ids.length === 0) {
    return resolved;
  }

  try {
    const response = await apiClient.post<BatchResolveData>(
      '/assets/resolve/batch',
      {
        assets: ids.map((input) => ({ input })),
      },
      { timeout: BATCH_TIMEOUT_MS },
    );

    for (const item of response.data?.results ?? []) {
      if (item.input && item.result?.asset) {
        resolved.set(item.input.toUpperCase(), item.result.asset);
      }
    }
  } catch {
    // A failed chunk stays uncached so the next visit can try again.
  }

  return resolved;
}

async function flushAssetBatch(batch: PendingBatch): Promise<void> {
  const chunks: string[][] = [];
  for (let index = 0; index < batch.ids.length; index += BATCH_SIZE) {
    chunks.push(batch.ids.slice(index, index + BATCH_SIZE));
  }

  const parts = await Promise.all(chunks.map((chunk) => fetchResolveBatch(chunk)));
  const resolved = new Map<string, ResolvedAssetFields>();
  for (const part of parts) {
    for (const [key, value] of part) {
      resolved.set(key, value);
    }
  }

  for (const [id, waiters] of batch.waiters) {
    const value = resolved.get(id) ?? null;
    for (const waiter of waiters) {
      waiter(value);
    }
  }
}

function enqueueAssetResolve(
  morningstarId: string,
): Promise<ResolvedAssetFields | null> {
  const id = morningstarId.toUpperCase();
  if (!pendingBatch) {
    pendingBatch = { ids: [], waiters: new Map(), timer: null };
  }

  const batch = pendingBatch;
  if (!batch.waiters.has(id)) {
    batch.ids.push(morningstarId);
  }

  return new Promise((resolve) => {
    const list = batch.waiters.get(id) ?? [];
    list.push(resolve);
    batch.waiters.set(id, list);

    if (batch.timer) {
      clearTimeout(batch.timer);
    }
    batch.timer = setTimeout(() => {
      if (pendingBatch === batch) {
        pendingBatch = null;
      }
      void flushAssetBatch(batch);
    }, BATCH_COALESCE_MS);
  });
}

/**
 * One cache entry per Morningstar id, shared by every portfolio that holds it.
 * The callback runs only on a miss. Concurrent misses are batched below.
 * A miss throws so a failed lookup is not stored for 24 hours.
 */
const readCachedAsset = unstable_cache(
  async (morningstarId: string): Promise<ResolvedAssetFields> => {
    const asset = await enqueueAssetResolve(morningstarId);
    if (!asset) {
      throw new Error(`Unresolved asset ${morningstarId}`);
    }
    return asset;
  },
  ['explore-asset-resolve'],
  { revalidate: ASSET_RESOLVE_REVALIDATE_SECONDS },
);

/**
 * Resolve holding names from the asset cache.
 * Cached ids skip the API. Misses go out in parallel batches of 20.
 * A failed id keeps the Morningstar id so the server HTML still lists it.
 */
export async function resolvePortfolioHoldings(
  assets: PortfolioAssetRef[],
): Promise<PortfolioHoldingView[]> {
  const sorted = [...assets].sort((a, b) => b.weight - a.weight);
  const uniqueIds: string[] = [];
  const seen = new Set<string>();

  for (const asset of sorted) {
    const key = asset.morningstarId.toUpperCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueIds.push(asset.morningstarId);
  }

  const resolved = new Map<string, ResolvedAssetFields>();
  await Promise.all(
    uniqueIds.map(async (morningstarId) => {
      try {
        const asset = await readCachedAsset(morningstarId);
        resolved.set(morningstarId.toUpperCase(), asset);
      } catch {
        // Leave this id on the identifier fallback.
      }
    }),
  );

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
