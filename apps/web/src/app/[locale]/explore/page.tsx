'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { getPublicPortfolios, type PublicPortfolioListItem } from '@/lib/api/portfolios';
import { queryKeys } from '@/lib/api/queryKeys';
import { useAuth } from '@/lib/auth';
import { useFavoritePortfolio } from '@/lib/hooks/useFavoritePortfolio';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { ArrowRightIcon, EditIcon, HeartFilledIcon, HeartOutlineIcon } from '@/components/ui/Icons';
import { AuthModal } from '@/components/auth/AuthModal';
import { VALIDATION } from '@/lib/constants';

function isPortfolioWeightValid(assets: { morningstarId: string; weight: number }[]): boolean {
  if (!assets.length) return false;

  const total = assets.reduce((sum, a) => sum + (a.weight || 0), 0);
  const diff = Math.abs(total - VALIDATION.PERCENTAGE_TOTAL);

  return diff <= VALIDATION.PERCENTAGE_TOLERANCE;
}

function buildAssetsParam(assets: { morningstarId: string; weight: number }[]): string {
  const param = assets.map((a) => `${a.morningstarId}:${a.weight}`).join(',');
  return encodeURIComponent(param);
}

type SortBy = 'recent' | 'favorites';

function ExploreCard({
  portfolio,
  onOpenBuilder,
  openAuthModalAndWait,
  onViewDetails,
}: {
  portfolio: PublicPortfolioListItem;
  onOpenBuilder: (p: PublicPortfolioListItem) => void;
  openAuthModalAndWait: () => Promise<void>;
  onViewDetails: () => void;
}) {
  const t = useTranslations('portfolios');
  const { isAuthenticated } = useAuth();
  const {
    isOwner,
    isFavorited,
    favoritesCount,
    toggleFavorite,
    isPending,
  } = useFavoritePortfolio(portfolio, isAuthenticated, {
    onOpenBuilder,
    openAuthModalAndWait,
  });

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1 flex items-start gap-2">
          {isOwner ? (
            <Button
              variant="ghost"
              size="sm"
              className="p-2 shrink-0"
              onClick={() => onOpenBuilder(portfolio)}
              aria-label={t('openInBuilder')}
              title={t('openInBuilder')}
            >
              <EditIcon className="w-4 h-4" />
            </Button>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1 p-2 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50 shrink-0"
              onClick={toggleFavorite}
              disabled={isPending}
              aria-label={isFavorited ? t('removeFromFavorites') : t('addToFavorites')}
              title={isFavorited ? t('removeFromFavorites') : t('addToFavorites')}
            >
              {isFavorited ? (
                <HeartFilledIcon className="w-5 h-5 text-red-500" />
              ) : (
                <HeartOutlineIcon className="w-5 h-5" />
              )}
              <span className="text-sm tabular-nums">{favoritesCount}</span>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="font-semibold text-slate-900 truncate text-left hover:underline block w-full"
              onClick={onViewDetails}
            >
              {portfolio.name}
            </button>
            <p className="text-sm text-slate-600 mt-1">
              {t('publicPortfolioByUser', { userName: portfolio.userName })}
            </p>
          </div>
        </div>
        <div className="flex items-center shrink-0">
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

export default function ExplorePortfoliosPage() {
  const t = useTranslations('portfolios');
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialName = searchParams.get('name') ?? '';
  const initialUserName = searchParams.get('userName') ?? '';
  const initialSort = (searchParams.get('sortBy') as SortBy) ?? 'recent';

  const [nameFilter, setNameFilter] = useState(initialName);
  const [userNameFilter, setUserNameFilter] = useState(initialUserName);
  const [sortBy, setSortBy] = useState<SortBy>(initialSort);
  const [debouncedName, setDebouncedName] = useState(initialName);
  const [debouncedUserName, setDebouncedUserName] = useState(initialUserName);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const authResolveRef = useRef<(() => void) | null>(null);

  const filters = useMemo(
    () => ({
      name: debouncedName.trim() || undefined,
      userName: debouncedUserName.trim() || undefined,
      sortBy,
    }),
    [debouncedName, debouncedUserName, sortBy]
  );

  const { data: portfolios = [], isLoading, error } = useQuery({
    queryKey: queryKeys.portfolios.publicList(filters),
    queryFn: () => getPublicPortfolios(filters),
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedName(nameFilter);
      setDebouncedUserName(userNameFilter);

      const trimmedName = nameFilter.trim();
      const trimmedUser = userNameFilter.trim();

      const next = new URLSearchParams();

      if (trimmedName) {
        next.set('name', trimmedName);
      }

      if (trimmedUser) {
        next.set('userName', trimmedUser);
      }

      if (sortBy !== 'recent') {
        next.set('sortBy', sortBy);
      }

      const queryString = next.toString();
      const currentQuery = searchParams.toString();

      if (queryString === currentQuery) {
        return;
      }

      router.replace(queryString ? `?${queryString}` : '');
    }, 300);

    return () => clearTimeout(handler);
  }, [nameFilter, userNameFilter, sortBy, router, searchParams]);

  const handleFilterChange = (field: 'name' | 'userName', value: string) => {
    if (field === 'name') {
      setNameFilter(value);
    } else {
      setUserNameFilter(value);
    }
  };

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

  const validPortfolios = useMemo(
    () =>
      portfolios.filter((portfolio) =>
        isPortfolioWeightValid(portfolio.assets)
      ),
    [portfolios]
  );

  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  } else if (!validPortfolios.length) {
    content = (
      <Card>
        <p className="text-slate-600 text-center py-8">{t('noPublicPortfolios')}</p>
      </Card>
    );
  } else {
    content = (
      <ul className="space-y-4">
        {validPortfolios.map((portfolio) => (
          <li key={portfolio.id}>
            <ExploreCard
              portfolio={portfolio}
              onOpenBuilder={handleOpenInBuilder}
              openAuthModalAndWait={openAuthModalAndWait}
              onViewDetails={() => router.push(`/explore/${portfolio.id}`)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-900">{t('exploreTitle')}</h1>
          <Button variant="ghost" onClick={() => router.push('/?resetBuilder=true')}>
            {t('backToBuilder')}
          </Button>
        </div>
        <p className="text-sm text-slate-600 mb-6">{t('exploreSubtitle')}</p>

        {(error as Error | null) && (
          <Alert variant="error" className="mb-4">
            {(error as Error).message || t('loadError')}
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('filterByNameLabel')}
            </label>
            <Input
              value={nameFilter}
              onChange={(e) => handleFilterChange('name', e.target.value)}
              placeholder={t('filterByNamePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('filterByUserLabel')}
            </label>
            <Input
              value={userNameFilter}
              onChange={(e) => handleFilterChange('userName', e.target.value)}
              placeholder={t('filterByUserPlaceholder')}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('sortByLabel')}
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="block w-full sm:w-auto rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="recent">{t('sortByRecent')}</option>
            <option value="favorites">{t('sortByFavorites')}</option>
          </select>
        </div>

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

