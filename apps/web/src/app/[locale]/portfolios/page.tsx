'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPortfolios,
  deletePortfolio,
  updatePortfolio,
  type PortfolioListItem,
} from '@/lib/api/portfolios';
import { queryKeys } from '@/lib/api/queryKeys';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { generateXRay } from '@/lib/api/xray';
import { VALIDATION } from '@/lib/constants';
import { TrashIcon, EditIcon } from '@/components/ui/Icons';
import { EditPortfolioModal } from '@/components/portfolio/EditPortfolioModal';

function buildAssetsParam(
  assets: { morningstarId: string; weight: number; amount?: number }[],
  useAmount: boolean,
): string {
  const param = assets
    .map((a) => {
      const value = useAmount && typeof a.amount === 'number' ? a.amount : a.weight;
      return `${a.morningstarId}:${value}`;
    })
    .join(',');
  return encodeURIComponent(param);
}

function isPortfolioWeightValid(assets: { morningstarId: string; weight: number }[]): boolean {
  if (!assets.length) return false;

  const total = assets.reduce((sum, a) => sum + (a.weight || 0), 0);
  const diff = Math.abs(total - VALIDATION.PERCENTAGE_TOTAL);

  return diff <= VALIDATION.PERCENTAGE_TOLERANCE;
}

export default function PortfoliosPage() {
  const t = useTranslations('portfolios');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [activeXRayPortfolioId, setActiveXRayPortfolioId] = useState<string | null>(null);
  const [xrayError, setXrayError] = useState<string | null>(null);
  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioListItem | null>(null);

  const { data: portfolios = [], isLoading, error } = useQuery({
    queryKey: queryKeys.portfolios.all,
    queryFn: getPortfolios,
    enabled: isAuthenticated && !!user?.emailVerified,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePortfolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolios.all });
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user?.emailVerified) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, user?.emailVerified, router]);

  const handleOpenInBuilder = (portfolio: PortfolioListItem) => {
    const hasAmounts = portfolio.assets.some(
      (asset) => typeof asset.amount === 'number' && !Number.isNaN(asset.amount),
    );
    const assetsParam = buildAssetsParam(portfolio.assets, hasAmounts);
    const allocationModeParam = hasAmounts ? '&allocationMode=amount' : '';
    router.push(`/?assets=${assetsParam}&portfolioId=${portfolio.id}${allocationModeParam}`);
  };

  const handleOpenXRay = async (portfolio: PortfolioListItem) => {
    setXrayError(null);
    setActiveXRayPortfolioId(portfolio.id);
    try {
      const result = await generateXRay(portfolio.assets);

      // Persist X-Ray URLs on the portfolio so they are available in public views
      try {
        await updatePortfolio(portfolio.id, {
          xrayShareableUrl: result.shareableUrl,
          xrayMorningstarUrl: result.morningstarUrl,
          xrayGeneratedAt: new Date().toISOString(),
        });

        // Refresh cached portfolios so UI stays in sync
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolios.all });
      } catch (updateErr) {
        // Non-fatal: we still open the X-Ray even if saving fails
        // eslint-disable-next-line no-console
        console.warn('Failed to persist X-Ray URLs on portfolio', updateErr);
      }

      if (result.morningstarUrl) {
        window.open(result.morningstarUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : tCommon('unexpectedError');
      setXrayError(message);
    } finally {
      setActiveXRayPortfolioId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(t('deleteConfirm', { name }))) return;
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // Error handled by mutation
    }
  };

  const handleEdit = (portfolio: PortfolioListItem) => {
    setEditingPortfolio(portfolio);
  };

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
  } else if (portfolios.length === 0) {
    content = (
      <Card>
        <p className="text-slate-600 text-center py-8">{t('empty')}</p>
        <Button className="mx-auto block" onClick={() => router.push('/')}>
          {t('createFirst')}
        </Button>
      </Card>
    );
  } else {
    content = (
      <ul className="space-y-4">
        {portfolios.map((portfolio) => (
          <li key={portfolio.id}>
            <Card className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-slate-900 truncate">
                      {portfolio.name}
                    </h2>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        portfolio.isPublic
                          ? 'bg-green-100 text-green-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {portfolio.isPublic ? t('public') : t('private')}
                    </span>
                  </div>
                  {portfolio.description && (
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                      {portfolio.description}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {t('updated', {
                      date: new Date(portfolio.updatedAt).toLocaleDateString(),
                    })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenXRay(portfolio)}
                      disabled={
                        activeXRayPortfolioId !== null ||
                        !isPortfolioWeightValid(portfolio.assets)
                      }
                    >
                      {t('viewXRay')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="px-2"
                      onClick={() => handleEdit(portfolio)}
                      aria-label={t('edit')}
                      title={t('edit')}
                    >
                      <EditIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 px-2"
                      onClick={() => handleDelete(portfolio.id, portfolio.name)}
                      disabled={deleteMutation.isPending}
                      aria-label={tCommon('remove')}
                      title={tCommon('remove')}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenInBuilder(portfolio)}
                  >
                    {t('openInBuilder')}
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <Button variant="ghost" onClick={() => router.push('/?resetBuilder=true')}>
            {t('backToBuilder')}
          </Button>
        </div>

        {(error || xrayError) && (
          <Alert variant="error" className="mb-4">
            {error instanceof Error ? error.message : xrayError || t('loadError')}
          </Alert>
        )}

        {content}
      </div>

      {editingPortfolio && (
        <EditPortfolioModal
          isOpen={!!editingPortfolio}
          portfolio={editingPortfolio}
          onClose={() => setEditingPortfolio(null)}
        />
      )}
    </main>
  );
}
