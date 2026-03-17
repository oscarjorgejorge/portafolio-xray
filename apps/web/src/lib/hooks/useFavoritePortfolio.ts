'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublicPortfolioListItem } from '@/lib/api/portfolios';
import { addFavorite, removeFavorite } from '@/lib/api/favorites';
import { queryKeys } from '@/lib/api/queryKeys';
import { setPendingFavorite } from '@/lib/favorites/pending-favorite-storage';

export interface UseFavoritePortfolioOptions {
  /** When on "my favorites" page, pass the favorite record id for unfavorite */
  favoriteId?: string;
  /** Called when user should be taken to the portfolio builder (owner flow) */
  onOpenBuilder: (portfolio: PublicPortfolioListItem) => void;
  /** Call to show auth modal; resolves when user has authenticated (e.g. after login/register in modal) */
  openAuthModalAndWait: () => Promise<void>;
}

export interface UseFavoritePortfolioResult {
  isOwner: boolean;
  isFavorited: boolean;
  favoritesCount: number;
  toggleFavorite: () => Promise<void>;
  isPending: boolean;
}

/**
 * Hook to handle favorite/pencil behavior for a public portfolio.
 * - If not authenticated, opening the heart triggers auth modal; after auth, a global handler will add favorite if needed.
 * - If owner, show pencil and open builder.
 * - If not owner, show heart and toggle favorite.
 */
export function useFavoritePortfolio(
  portfolio: PublicPortfolioListItem,
  isAuthenticated: boolean,
  options: UseFavoritePortfolioOptions
): UseFavoritePortfolioResult {
  const { favoriteId, onOpenBuilder, openAuthModalAndWait } = options;
  const queryClient = useQueryClient();

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolios.publicList() });
    queryClient.invalidateQueries({
      queryKey: queryKeys.portfolios.publicById(portfolio.id),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all });
  }, [queryClient, portfolio.id]);

  const addMutation = useMutation({
    mutationFn: addFavorite,
    onSuccess: () => invalidateQueries(),
  });

  const removeMutation = useMutation({
    mutationFn: removeFavorite,
    onSuccess: () => invalidateQueries(),
  });

  const toggleFavorite = useCallback(async () => {
    if (!isAuthenticated) {
      // Mark this portfolio as pending favorite and trigger auth flow.
      setPendingFavorite(portfolio.id);
      await openAuthModalAndWait();
      // The actual favorite will be applied after auth by a global handler.
      return;
    }

    if (portfolio.isOwnedByCurrentUser) {
      onOpenBuilder(portfolio);
      return;
    }

    if (portfolio.isFavoritedByCurrentUser && (portfolio.favoriteId ?? favoriteId)) {
      await removeMutation.mutateAsync(portfolio.favoriteId ?? favoriteId!);
    } else {
      await addMutation.mutateAsync(portfolio.id);
    }
  }, [
    isAuthenticated,
    portfolio,
    favoriteId,
    onOpenBuilder,
    openAuthModalAndWait,
    addMutation,
    removeMutation,
  ]);

  const isPending = addMutation.isPending || removeMutation.isPending;

  return {
    isOwner: Boolean(portfolio.isOwnedByCurrentUser),
    isFavorited: Boolean(portfolio.isFavoritedByCurrentUser),
    favoritesCount: portfolio.favoritesCount ?? 0,
    toggleFavorite,
    isPending,
  };
}

