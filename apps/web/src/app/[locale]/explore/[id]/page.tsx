'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import {
  getPublicPortfolio,
  type PublicPortfolioListItem,
} from '@/lib/api/portfolios';
import { queryKeys } from '@/lib/api/queryKeys';
import { resolveAsset } from '@/lib/api/assets';
import { useAuth } from '@/lib/auth';
import { useFavoritePortfolio } from '@/lib/hooks/useFavoritePortfolio';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { EditIcon, ExternalLinkIcon, HeartFilledIcon, HeartOutlineIcon } from '@/components/ui/Icons';
import { AuthModal } from '@/components/auth/AuthModal';

function buildAssetsParam(assets: { morningstarId: string; weight: number }[]): string {
  const param = assets.map((a) => `${a.morningstarId}:${a.weight}`).join(',');
  return encodeURIComponent(param);
}

export default function PublicPortfolioDetailPage() {
  const t = useTranslations('portfolios');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();

  const id = useMemo(() => {
    const rawId = (params as { id?: string | string[] }).id;
    if (Array.isArray(rawId)) return rawId[0];
    return rawId ?? '';
  }, [params]);

  const {
    data: portfolio,
    isLoading,
    error,
  } = useQuery<PublicPortfolioListItem | undefined>({
    queryKey: id ? queryKeys.portfolios.publicById(id) : ['portfolios', 'public', 'byId', 'missing'],
    queryFn: () => getPublicPortfolio(id),
    enabled: Boolean(id),
  });

  const [copied, setCopied] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const authResolveRef = useRef<(() => void) | null>(null);

  const openAuthModalAndWait = useCallback(
    () =>
      new Promise<void>((resolve) => {
        authResolveRef.current = resolve;
        setShowAuthModal(true);
      }),
    []
  );

  const handleOpenInBuilder = useCallback(
    (p: PublicPortfolioListItem) => {
      const assetsParam = buildAssetsParam(p.assets);
      router.push(`/?assets=${assetsParam}&portfolioId=${p.id}`);
    },
    [router]
  );

  const handleAuthSuccess = useCallback(() => {
    setShowAuthModal(false);
    authResolveRef.current?.();
    authResolveRef.current = null;
  }, []);

  if (!id) {
    return (
      <main className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Alert variant="error">{tCommon('unexpectedError')}</Alert>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !portfolio) {
    const is404 =
      error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status?: number }).status === 404;
    let errorMessage = tCommon('unexpectedError');
    if (is404) errorMessage = t('portfolioUnavailable');
    else if (error instanceof Error) errorMessage = error.message;
    return (
      <main className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <Button variant="ghost" onClick={() => router.push('/explore')}>
            {t('exploreTitle')}
          </Button>
          <Alert variant="error">{errorMessage}</Alert>
        </div>
      </main>
    );
  }

  return (
    <PublicPortfolioContent
      portfolio={portfolio}
      isAuthenticated={isAuthenticated}
      onOpenInBuilder={handleOpenInBuilder}
      openAuthModalAndWait={openAuthModalAndWait}
      onAuthSuccess={handleAuthSuccess}
      showAuthModal={showAuthModal}
      onCloseAuthModal={() => {
        setShowAuthModal(false);
        authResolveRef.current?.();
        authResolveRef.current = null;
      }}
    />
  );
}

interface PublicPortfolioContentProps {
  portfolio: PublicPortfolioListItem;
  isAuthenticated: boolean;
  onOpenInBuilder: (p: PublicPortfolioListItem) => void;
  openAuthModalAndWait: () => Promise<void>;
  onAuthSuccess: () => void;
  showAuthModal: boolean;
  onCloseAuthModal: () => void;
}

function PublicPortfolioContent({
  portfolio,
  isAuthenticated,
  onOpenInBuilder,
  openAuthModalAndWait,
  onAuthSuccess,
  showAuthModal,
  onCloseAuthModal,
}: PublicPortfolioContentProps) {
  const t = useTranslations('portfolios');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const {
    isOwner,
    isFavorited,
    favoritesCount,
    toggleFavorite,
    isPending: favoritePending,
  } = useFavoritePortfolio(portfolio, isAuthenticated, {
    onOpenBuilder: onOpenInBuilder,
    openAuthModalAndWait,
  });

  const xrayUrl = portfolio.xrayMorningstarUrl ?? '';
  const publicUrl =
    typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore copy errors
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">
                {portfolio.name}
              </h1>
              {isOwner && (
                <button
                  type="button"
                  className="p-1.5 rounded text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  onClick={() => onOpenInBuilder(portfolio)}
                  aria-label={t('openInBuilder')}
                  title={t('openInBuilder')}
                >
                  <EditIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {isOwner
                ? t('thisIsYourPortfolio')
                : t('publicPortfolioByUser', { userName: portfolio.userName })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {!isOwner && (
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={toggleFavorite}
                disabled={favoritePending}
                aria-label={isFavorited ? t('removeFromFavorites') : t('addToFavorites')}
              >
                {isFavorited ? (
                  <HeartFilledIcon className="w-5 h-5 text-red-500" />
                ) : (
                  <HeartOutlineIcon className="w-5 h-5" />
                )}
                <span className="tabular-nums">{favoritesCount}</span>
              </button>
            )}
            <Button variant="ghost" size="sm" onClick={() => router.push('/explore')}>
              {tNav('explorePortfolios')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {xrayUrl && (
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                window.open(xrayUrl, '_blank', 'noopener,noreferrer')
              }
            >
              {t('viewXRay')}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyPublicUrl}
          >
            {copied ? tCommon('copied') : t('copyPortfolioLink')}
          </Button>
        </div>

        {portfolio.description && (
          <p className="text-sm text-slate-600">
            {portfolio.description}
          </p>
        )}

        <div className="space-y-4">
          {portfolio.assets
            .slice()
            .sort((a, b) => b.weight - a.weight)
            .map((asset) => (
              <PublicPortfolioAssetRow
                key={asset.morningstarId}
                asset={asset}
              />
            ))}
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={onCloseAuthModal}
        onAuthSuccess={onAuthSuccess}
      />
    </main>
  );
}

interface PublicPortfolioAssetRowProps {
  asset: { morningstarId: string; weight: number };
}

function PublicPortfolioAssetRow({ asset }: PublicPortfolioAssetRowProps) {
  const tAssetRow = useTranslations('assetRow');

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.assets.resolve(asset.morningstarId),
    queryFn: () => resolveAsset(asset.morningstarId),
  });

  const resolved = data?.asset;
  const displayName = resolved?.name ?? asset.morningstarId;
  const type = resolved?.type;
  const ticker = resolved?.ticker ?? undefined;
  const morningstarId = resolved?.morningstarId ?? asset.morningstarId;
  const url = resolved?.url;

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white flex items-start gap-3">
      <div className="flex-1 min-w-0 pr-2">
        <h4 className="font-semibold text-slate-900 break-words leading-tight">
          {displayName}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex align-middle ml-1 mb-2 text-blue-600 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded flex-shrink-0"
              aria-label={displayName}
            >
              <ExternalLinkIcon />
            </a>
          )}
        </h4>
        <div className="flex items-center gap-2 sm:gap-4 text-sm text-slate-600 mt-1 flex-wrap">
          {type && (
            <span className="font-medium uppercase">
              {type}
            </span>
          )}
          {ticker && (
            <span>
              <span className="font-medium">{tAssetRow('ticker')}</span> {ticker}
            </span>
          )}
          {morningstarId && (
            <span>
              <span className="font-medium">{tAssetRow('morningstarId')}</span> {morningstarId}
            </span>
          )}
          {isLoading && <Spinner size="sm" className="text-slate-400" />}
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-600">
            {error instanceof Error
              ? error.message
              : 'Failed to resolve asset details.'}
          </p>
        )}
      </div>
      <div className="flex-shrink-0 text-sm font-medium text-slate-700">
        {asset.weight.toFixed(2)}%
      </div>
    </div>
  );
}

