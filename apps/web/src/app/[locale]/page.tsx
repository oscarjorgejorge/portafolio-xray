'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { PortfolioBuilder } from '@/components/portfolio/PortfolioBuilder';
import { PageLoading } from '@/components/ui/PageLoading';
import { PortfolioBuilderSkeleton } from '@/components/ui/Skeleton';
import type { PortfolioAsset } from '@/types';
import { resolveAsset } from '@/lib/api/assets';
import { generateSimpleId } from '@/lib/utils/id';

function HomePageContent() {
  const searchParams = useSearchParams();
  const [initialAssets, setInitialAssets] = useState<PortfolioAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Parse shareable URL if assets param exists
    const assetsParam = searchParams.get('assets');
    if (!assetsParam) return;

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);

    const parseAndResolveAssets = async () => {
      try {
        const decodedAssetsParam = decodeURIComponent(assetsParam);
        const pairs = decodedAssetsParam.split(',');
        const resolvedAssets: PortfolioAsset[] = [];

        for (const pair of pairs) {
          // Check if request was cancelled
          if (abortController.signal.aborted) return;

          const [identifier, weightStr] = pair.split(':');
          const weight = parseFloat(weightStr) || 0;

          if (identifier && !isNaN(weight)) {
            try {
              const result = await resolveAsset(identifier, undefined, {
                signal: abortController.signal,
              });

              // Check again after async operation
              if (abortController.signal.aborted) return;

              if (result.success && result.asset) {
                resolvedAssets.push({
                  id: generateSimpleId(),
                  identifier: identifier.toUpperCase(),
                  asset: result.asset,
                  weight,
                  status: 'resolved',
                });
              } else {
                resolvedAssets.push({
                  id: generateSimpleId(),
                  identifier: identifier.toUpperCase(),
                  weight,
                  status: 'error',
                  error: result.error || 'Could not resolve asset',
                });
              }
            } catch (error) {
              // Ignore abort errors
              if (error instanceof Error && error.name === 'AbortError') return;

              resolvedAssets.push({
                id: generateSimpleId(),
                identifier: identifier.toUpperCase(),
                weight,
                status: 'error',
                error: 'Failed to resolve asset',
              });
            }
          }
        }

        // Final check before setting state
        if (!abortController.signal.aborted) {
          setInitialAssets(resolvedAssets);
        }
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Error parsing shareable URL:', error);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    parseAndResolveAssets();

    // Cleanup function
    return () => {
      abortController.abort();
    };
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Portfolio X-Ray Generator
          </h1>
          <p className="text-slate-700">
            Generate Morningstar X-Ray reports for your portfolio. Enter ISINs
            or Morningstar IDs and get instant analysis.
          </p>
        </div>

        {isLoading ? (
          <PortfolioBuilderSkeleton assetCount={3} />
        ) : (
          <PortfolioBuilder initialAssets={initialAssets} />
        )}
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <HomePageContent />
    </Suspense>
  );
}

