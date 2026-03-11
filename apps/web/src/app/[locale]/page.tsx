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
import { useQuery } from '@tanstack/react-query';
import { getPortfolio } from '@/lib/api/portfolios';
import { queryKeys } from '@/lib/api/queryKeys';

const RESOLVED_ASSETS_CACHE_KEY = 'builderResolvedAssetsCache';

function HomePageContent() {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const tVerify = useTranslations('auth.verifyEmail');
  const searchParams = useSearchParams();
  const [initialAssets, setInitialAssets] = useState<PortfolioAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [urlParseError, setUrlParseError] = useState<string | null>(null);
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);
  const [showAlreadyVerified, setShowAlreadyVerified] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const portfolioId = searchParams.get('portfolioId');
  const initialAllocationModeParam = searchParams.get('allocationMode');
  const resetBuilder = searchParams.get('resetBuilder') === 'true';

  const {
    data: portfolio,
    isLoading: isPortfolioLoading,
    error: portfolioError,
  } = useQuery({
    queryKey: portfolioId
      ? queryKeys.portfolios.byId(portfolioId)
      : ['portfolios', 'none'],
    queryFn: () => {
      if (!portfolioId) {
        throw new Error('Missing portfolioId');
      }
      return getPortfolio(portfolioId);
    },
    enabled: !!portfolioId,
  });

  useEffect(() => {
    const verified = searchParams.get('verified');
    const alreadyVerified = searchParams.get('alreadyVerified');
    if (verified === 'true') {
      setShowVerificationSuccess(true);
      const t = setTimeout(() => setShowVerificationSuccess(false), 5000);
      return () => clearTimeout(t);
    }
    if (alreadyVerified === 'true') {
      setShowAlreadyVerified(true);
      const t = setTimeout(() => setShowAlreadyVerified(false), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  useEffect(() => {
    // Parse shareable URL if assets param exists
    const assetsParam = searchParams.get('assets');
    if (!assetsParam) return;

    // If we have cached resolved assets for this exact param, reuse them
    if (typeof window !== 'undefined') {
      try {
        const rawCache = window.sessionStorage.getItem(
          RESOLVED_ASSETS_CACHE_KEY
        );
        if (rawCache) {
          const cache = JSON.parse(rawCache) as Record<string, PortfolioAsset[]>;
          const cached = cache[assetsParam];
          if (cached && Array.isArray(cached) && cached.length > 0) {
            setInitialAssets(cached);
            return;
          }
        }
      } catch {
        // Ignore cache errors and fall back to resolving
      }
    }

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

        const resolveWithRetry = async (
          identifier: string
        ): Promise<Awaited<ReturnType<typeof resolveAsset>> | null> => {
          const maxAttempts = 3;
          let attempt = 0;
          let lastError: unknown = null;

          while (attempt < maxAttempts && !abortController.signal.aborted) {
            try {
              return await resolveAsset(identifier, undefined, {
                signal: abortController.signal,
              });
            } catch (error) {
              // Ignore abort errors
              if (error instanceof Error && error.name === 'AbortError') {
                return null;
              }
              lastError = error;
              attempt += 1;

              if (attempt < maxAttempts) {
                // Small backoff before retrying
                await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
              }
            }
          }

          // After retries, log once and treat as failure
          if (lastError) {
            captureException(
              lastError instanceof Error
                ? lastError
                : new Error('Failed to resolve asset after retries'),
              {
                tags: { action: 'asset-resolve-retry' },
                extra: { identifier, attempts: maxAttempts },
              }
            );
          }

          return null;
        };

        for (const pair of pairs) {
          // Check if request was cancelled
          if (abortController.signal.aborted) return;

          const [identifier, weightStr] = pair.split(':');
          const weight = parseFloat(weightStr) || 0;

          if (identifier && !isNaN(weight)) {
            const result = await resolveWithRetry(identifier);

            // Check again after async operation
            if (abortController.signal.aborted) return;

            if (result && result.success && result.asset) {
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
                error:
                  result?.error ||
                  'Failed to resolve asset after multiple attempts',
              });
            }
          }
        }

        // Final check before setting state
        if (!abortController.signal.aborted) {
          setInitialAssets(resolvedAssets);

          // Persist resolved assets in a small session cache by assetsParam
          if (typeof window !== 'undefined') {
            try {
              const rawCache =
                window.sessionStorage.getItem(RESOLVED_ASSETS_CACHE_KEY);
              const cache = rawCache
                ? (JSON.parse(rawCache) as Record<string, PortfolioAsset[]>)
                : {};
              cache[assetsParam] = resolvedAssets;
              window.sessionStorage.setItem(
                RESOLVED_ASSETS_CACHE_KEY,
                JSON.stringify(cache)
              );
            } catch {
              // Ignore cache errors
            }
          }
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

  // Fallback: when opening by portfolioId only (e.g. "Abrir en constructor"), if assets
  // param is missing or empty, populate builder from portfolio.assets
  useEffect(() => {
    const assetsParam = searchParams.get('assets');
    if (assetsParam || !portfolioId || !portfolio?.assets?.length) return;

    const ac = new AbortController();
    setIsLoading(true);

    const resolveWithRetry = async (
      identifier: string
    ): Promise<Awaited<ReturnType<typeof resolveAsset>> | null> => {
      const maxAttempts = 3;
      let attempt = 0;
      let lastError: unknown = null;
      while (attempt < maxAttempts && !ac.signal.aborted) {
        try {
          return await resolveAsset(identifier, undefined, { signal: ac.signal });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return null;
          lastError = error;
          attempt += 1;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
      }
      if (lastError) {
        captureException(
          lastError instanceof Error ? lastError : new Error('Failed to resolve asset'),
          { tags: { action: 'portfolio-fallback-resolve' } }
        );
      }
      return null;
    };

    (async () => {
      try {
        const resolved: PortfolioAsset[] = [];
        for (const a of portfolio.assets) {
          if (ac.signal.aborted) return;
          const result = await resolveWithRetry(a.morningstarId);
          if (ac.signal.aborted) return;
          if (result?.success && result.asset) {
            resolved.push({
              id: generateSimpleId(),
              identifier: a.morningstarId.toUpperCase(),
              asset: result.asset,
              weight: a.weight,
              status: 'resolved',
            });
          } else {
            resolved.push({
              id: generateSimpleId(),
              identifier: a.morningstarId.toUpperCase(),
              weight: a.weight,
              status: 'error',
              error: result?.error ?? 'Failed to resolve asset',
            });
          }
        }
        if (!ac.signal.aborted) setInitialAssets(resolved);
      } finally {
        if (!ac.signal.aborted) setIsLoading(false);
      }
    })();

    return () => ac.abort();
  }, [portfolioId, portfolio?.assets, searchParams]);

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

        {showVerificationSuccess && (
          <Alert variant="success" className="mb-6">
            <div className="font-semibold mb-1">{tVerify('success')}</div>
            <div>{tVerify('successMessage')}</div>
          </Alert>
        )}

        {showAlreadyVerified && (
          <Alert variant="success" className="mb-6">
            {tVerify('alreadyVerified')}
          </Alert>
        )}

        {urlParseError && (
          <Alert variant="warning" className="mb-6">
            {urlParseError}
          </Alert>
        )}

        {portfolioId && portfolioError && (
          <Alert variant="error" className="mb-6">
            {portfolioError instanceof Error ? portfolioError.message : tCommon('unexpectedError')}
          </Alert>
        )}

        {isLoading || (portfolioId && isPortfolioLoading) ? (
          <PortfolioBuilderSkeleton assetCount={3} />
        ) : (
          <PortfolioBuilder
            initialAssets={initialAssets}
            portfolioId={portfolioId || undefined}
            initialName={portfolio?.name}
            initialDescription={portfolio?.description}
            initialIsPublic={portfolio?.isPublic}
            resetBuilder={resetBuilder}
            initialAllocationMode={
              initialAllocationModeParam === 'amount' || initialAllocationModeParam === 'percentage'
                ? (initialAllocationModeParam as 'amount' | 'percentage')
                : undefined
            }
          />
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

