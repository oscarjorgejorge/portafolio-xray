import { apiClient } from './client';
import type { PublicPortfolioListItem } from './portfolios';

export interface FavoriteRecord {
  id: string;
  portfolioId: string;
  createdAt: string;
  portfolio: PublicPortfolioListItem;
}

export interface AddFavoriteResponse {
  id: string;
  portfolioId: string;
  createdAt: string;
}

/**
 * List the current user's favorites (each item includes full portfolio data).
 */
export async function getMyFavorites(): Promise<FavoriteRecord[]> {
  const response = await apiClient.get<FavoriteRecord[]>('/favorites');
  return response.data;
}

/**
 * Add a public portfolio to the current user's favorites.
 * Fails if portfolio is not found or is owned by the current user.
 */
export async function addFavorite(
  portfolioId: string
): Promise<AddFavoriteResponse> {
  const response = await apiClient.post<AddFavoriteResponse>('/favorites', {
    portfolioId,
  });
  return response.data;
}

/**
 * Remove a favorite by its id. Only the owner of the favorite can remove it.
 */
export async function removeFavorite(favoriteId: string): Promise<void> {
  await apiClient.delete(`/favorites/${favoriteId}`);
}
