'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PortfolioBuilder } from '@/components/portfolio/PortfolioBuilder';
import { PageLoading } from '@/components/ui/PageLoading';
import { PortfolioBuilderSkeleton } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import { captureException } from '@/lib/services/errorReporting';
import type { PortfolioAsset } from '@/types';
import { resolveAsset } from '@/lib/api/assets';
import { generateSimpleId } from '@/lib/utils/id';

function HomePageContent() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const [initialAssets, setInitialAssets] = useState<PortfolioAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [urlParseError, setUrlParseError] = useState<string | null>(null);
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
    setUrlParseError(null);

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
        captureException(error instanceof Error ? error : new Error('Failed to parse shareable URL'), {
          tags: { action: 'url-parse' },
        });
        setUrlParseError(t('urlParseError'));
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
  }, [searchParams, t]);

  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {t('title')}
          </h1>
          <p className="text-slate-700">
            {t('subtitle')}
          </p>
        </div>

        {urlParseError && (
          <Alert variant="warning" className="mb-6">
            {urlParseError}
          </Alert>
        )}

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
  const tCommon = useTranslations('common');
  
  return (
    <Suspense fallback={<PageLoading message={tCommon('loading')} />}>
      <HomePageContent />
    </Suspense>
  );
}

