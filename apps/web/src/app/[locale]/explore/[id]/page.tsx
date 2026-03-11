'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import {
  getPublicPortfolio,
  type PublicPortfolioListItem,
} from '@/lib/api/portfolios';
import { queryKeys } from '@/lib/api/queryKeys';
import { resolveAsset } from '@/lib/api/assets';
import {
  createComment,
  deleteComment,
  getPortfolioComments,
  updateComment,
  type CommentItem,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAuthModal } from '@/lib/auth/AuthModalContext';
import { useFavoritePortfolio } from '@/lib/hooks/useFavoritePortfolio';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { EditIcon, ExternalLinkIcon, HeartFilledIcon, HeartOutlineIcon, TrashIcon } from '@/components/ui/Icons';

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
  const { openAuthModalAndWait } = useAuthModal();

  const handleOpenInBuilder = useCallback(
    (p: PublicPortfolioListItem) => {
      const assetsParam = buildAssetsParam(p.assets);
      router.push(`/?assets=${assetsParam}&portfolioId=${p.id}`);
    },
    [router]
  );

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
    />
  );
}

interface PublicPortfolioContentProps {
  portfolio: PublicPortfolioListItem;
  isAuthenticated: boolean;
  onOpenInBuilder: (p: PublicPortfolioListItem) => void;
  openAuthModalAndWait: () => Promise<void>;
}

function PublicPortfolioContent({
  portfolio,
  isAuthenticated,
  onOpenInBuilder,
  openAuthModalAndWait,
}: PublicPortfolioContentProps) {
  const t = useTranslations('portfolios');
  const tCommon = useTranslations('common');
  const tComments = useTranslations('comments');
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

        <CommentsSection
          portfolioId={portfolio.id}
          isAuthenticated={isAuthenticated}
          openAuthModalAndWait={openAuthModalAndWait}
        />
      </div>
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

interface CommentsSectionProps {
  portfolioId: string;
  isAuthenticated: boolean;
  openAuthModalAndWait: () => Promise<void>;
}

function CommentsSection({
  portfolioId,
  isAuthenticated,
  openAuthModalAndWait,
}: CommentsSectionProps) {
  const tComments = useTranslations('comments');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const [newComment, setNewComment] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [commentToDeleteId, setCommentToDeleteId] = useState<string | null>(null);

  const {
    data: comments = [],
    isLoading,
    error,
  } = useQuery<CommentItem[]>({
    queryKey: queryKeys.comments.byPortfolio(portfolioId),
    queryFn: () => getPortfolioComments(portfolioId),
  });

  const invalidateComments = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.comments.byPortfolio(portfolioId),
    });
  }, [portfolioId, queryClient]);

  const createMutation = useMutation({
    mutationFn: (content: string) => createComment(portfolioId, content),
    onSuccess: () => {
      setNewComment('');
      invalidateComments();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; content: string }) =>
      updateComment(portfolioId, payload.id, payload.content),
    onSuccess: () => {
      setEditingId(null);
      setEditingContent('');
      invalidateComments();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteComment(portfolioId, id),
    onSuccess: () => {
      invalidateComments();
    },
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) {
      setLocalError(tComments('createError'));
      return;
    }
    setLocalError(null);

    if (!isAuthenticated) {
      await openAuthModalAndWait();
    }

    try {
      await createMutation.mutateAsync(trimmed);
    } catch {
      setLocalError(tComments('createError'));
    }
  };

  const startEdit = (comment: CommentItem) => {
    setEditingId(comment.id);
    setEditingContent(comment.content);
    setLocalError(null);
  };

  const handleEditSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    const trimmed = editingContent.trim();
    if (!trimmed) {
      setLocalError(tComments('updateError'));
      return;
    }
    setLocalError(null);
    try {
      await updateMutation.mutateAsync({ id: editingId, content: trimmed });
    } catch {
      setLocalError(tComments('updateError'));
    }
  };

  const handleDeleteClick = (id: string) => {
    setLocalError(null);
    setCommentToDeleteId(id);
  };

  const handleDeleteConfirm = () => {
    if (!commentToDeleteId) return;
    deleteMutation.mutate(commentToDeleteId, {
      onSuccess: () => setCommentToDeleteId(null),
      onError: () => setLocalError(tComments('deleteError')),
      onSettled: () => setCommentToDeleteId(null),
    });
  };

  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <ConfirmModal
        isOpen={commentToDeleteId !== null}
        onClose={() => setCommentToDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title={tComments('deleteConfirmTitle')}
        message={tComments('deleteConfirm')}
        confirmLabel={deleteMutation.isPending ? tComments('deleting') : tComments('delete')}
        cancelLabel={tCommon('cancel')}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      <h2 className="text-lg font-semibold text-slate-900 mb-3">
        {tComments('title')}
      </h2>

      {(error || localError) && (
        <Alert variant="error" className="mb-3">
          {localError ||
            (error instanceof Error
              ? error.message
              : tComments('loadError'))}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-2 mb-6">
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px]"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={tComments('placeholder')}
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {!isAuthenticated && (
            <p className="text-xs text-slate-500">
              {tComments('loginHint')}
            </p>
          )}
          <div className="flex items-center gap-2 sm:justify-end">
            {createMutation.isPending && (
              <Spinner size="sm" className="text-slate-400" />
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createMutation.isPending || !newComment.trim()}
              className="inline-flex items-center gap-2 shadow-sm"
            >
              {createMutation.isPending
                ? tComments('submitting')
                : tComments('submit')}
            </Button>
          </div>
        </div>
      </form>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" className="text-slate-400" />
          <span>{tCommon('loading')}</span>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-500">{tComments('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="border border-slate-200 rounded-lg p-3 bg-white"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {comment.user.userName || comment.user.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {comment.isOwnedByCurrentUser && editingId !== comment.id && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => startEdit(comment)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1"
                    >
                      <EditIcon className="w-4 h-4" />
                      <span>{tComments('edit')}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDeleteClick(comment.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1"
                    >
                      <TrashIcon className="w-4 h-4" />
                      <span>
                        {deleteMutation.isPending
                          ? tComments('deleting')
                          : tComments('delete')}
                      </span>
                    </Button>
                  </div>
                )}
              </div>

              {editingId === comment.id ? (
                <form onSubmit={handleEditSave} className="space-y-2">
                  <textarea
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]"
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingId(null);
                        setEditingContent('');
                      }}
                      className="inline-flex items-center gap-1.5"
                    >
                      {tComments('cancel')}
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={updateMutation.isPending}
                      className="inline-flex items-center gap-1.5"
                    >
                      {updateMutation.isPending
                        ? tComments('submitting')
                        : tComments('save')}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {comment.content}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
