'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { getMyFavorites, type FavoriteRecord } from '@/lib/api/favorites';
import { queryKeys } from '@/lib/api/queryKeys';
import { useAuth } from '@/lib/auth';
import { useFavoritePortfolio } from '@/lib/hooks/useFavoritePortfolio';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { ArrowRightIcon, HeartFilledIcon } from '@/components/ui/Icons';
import { AuthModal } from '@/components/auth/AuthModal';
import type { PublicPortfolioListItem } from '@/lib/api/portfolios';

function buildAssetsParam(assets: { morningstarId: string; weight: number }[]): string {
  const param = assets.map((a) => `${a.morningstarId}:${a.weight}`).join(',');
  return encodeURIComponent(param);
}

function FavoriteCard({
  item,
  onOpenBuilder,
  openAuthModalAndWait,
  onViewDetails,
}: {
  item: FavoriteRecord;
  onOpenBuilder: (p: PublicPortfolioListItem) => void;
  openAuthModalAndWait: () => Promise<void>;
  onViewDetails: () => void;
}) {
  const t = useTranslations('portfolios');
  const { isAuthenticated } = useAuth();
  const { portfolio } = item;
  const { favoritesCount, toggleFavorite, isPending } =
    useFavoritePortfolio(portfolio, isAuthenticated, {
      favoriteId: item.id,
      onOpenBuilder,
      openAuthModalAndWait,
    });

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="font-semibold text-slate-900 truncate text-left hover:underline"
              onClick={onViewDetails}
            >
              {portfolio.name}
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {t('publicPortfolioByUser', { userName: portfolio.userName })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="flex items-center gap-1 p-2 rounded text-red-500 hover:bg-red-50 disabled:opacity-50"
            onClick={toggleFavorite}
            disabled={isPending}
            aria-label={t('removeFromFavorites')}
            title={t('removeFromFavorites')}
          >
            <HeartFilledIcon className="w-5 h-5" />
            <span className="text-sm tabular-nums">{favoritesCount}</span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            onClick={onViewDetails}
            aria-label={t('viewDetails')}
          >
            <ArrowRightIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function FavoritesPage() {
  const t = useTranslations('portfolios');
  const router = useRouter();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const authResolveRef = useRef<(() => void) | null>(null);

  const { data: favorites = [], isLoading, error } = useQuery({
    queryKey: queryKeys.favorites.all,
    queryFn: getMyFavorites,
    enabled: isAuthenticated && !!user?.emailVerified,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user?.emailVerified) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, user?.emailVerified, router]);

  const handleOpenInBuilder = useCallback((portfolio: PublicPortfolioListItem) => {
    const assetsParam = buildAssetsParam(portfolio.assets);
    router.push(`/?assets=${assetsParam}&portfolioId=${portfolio.id}`);
  }, [router]);

  const openAuthModalAndWait = useCallback(
    () =>
      new Promise<void>((resolve) => {
        authResolveRef.current = resolve;
        setShowAuthModal(true);
      }),
    []
  );

  const handleAuthSuccess = useCallback(() => {
    setShowAuthModal(false);
    authResolveRef.current?.();
    authResolveRef.current = null;
  }, []);

  if (authLoading || (!isAuthenticated && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.emailVerified) {
    return null;
  }

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  } else if (!favorites.length) {
    content = (
      <Card>
        <p className="text-slate-600 text-center py-8">{t('noFavorites')}</p>
        <Button
          variant="primary"
          className="mx-auto block"
          onClick={() => router.push('/explore')}
        >
          {t('exploreTitle')}
        </Button>
      </Card>
    );
  } else {
    content = (
      <ul className="space-y-4">
        {favorites.map((item) => (
          <li key={item.id}>
            <FavoriteCard
              item={item}
              onOpenBuilder={handleOpenInBuilder}
              openAuthModalAndWait={openAuthModalAndWait}
              onViewDetails={() => router.push(`/explore/${item.portfolio.id}`)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{t('myFavorites')}</h1>
          <Button variant="ghost" onClick={() => router.push('/?resetBuilder=true')}>
            {t('backToBuilder')}
          </Button>
        </div>

        {(error as Error | null) && (
          <Alert variant="error" className="mb-4">
            {(error as Error).message || t('loadError')}
          </Alert>
        )}

        {content}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          authResolveRef.current?.();
          authResolveRef.current = null;
        }}
        onAuthSuccess={handleAuthSuccess}
      />
    </main>
  );
}
