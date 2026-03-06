import { apiClient } from './client';

export interface PortfolioAsset {
  morningstarId: string;
  weight: number;
  amount?: number;
}

export interface CreatePortfolioRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
  assets: PortfolioAsset[];
}

export interface UpdatePortfolioRequest {
  name?: string;
  description?: string | null;
  isPublic?: boolean;
  assets?: PortfolioAsset[];
  xrayShareableUrl?: string | null;
  xrayMorningstarUrl?: string | null;
  xrayGeneratedAt?: string | null;
}

export interface PortfolioListItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  assets: PortfolioAsset[];
  xrayShareableUrl: string | null;
  xrayMorningstarUrl: string | null;
  xrayGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPortfolioListItem extends PortfolioListItem {
  /**
   * Display name of the portfolio owner
   */
  userName: string;
  favoritesCount: number;
  /** Present when request was authenticated */
  isOwnedByCurrentUser?: boolean;
  /** Present when request was authenticated */
  isFavoritedByCurrentUser?: boolean;
  /** When favorited, the favorite record id for unfavorite (DELETE) */
  favoriteId?: string;
}

export interface GetPublicPortfoliosParams {
  name?: string;
  userName?: string;
  sortBy?: 'recent' | 'favorites';
}

/**
 * Create a new portfolio for the current user.
 */
export async function createPortfolio(
  body: CreatePortfolioRequest
): Promise<PortfolioListItem> {
  const response = await apiClient.post<PortfolioListItem>('/portfolios', body);
  return response.data;
}

/**
 * List all portfolios for the current user.
 */
export async function getPortfolios(): Promise<PortfolioListItem[]> {
  const response = await apiClient.get<PortfolioListItem[]>('/portfolios');
  return response.data;
}

/**
 * List all public portfolios across all users.
 * Optional filters:
 * - name: substring match on portfolio name
 * - userName: substring match on owner display name
 */
export async function getPublicPortfolios(
  params?: GetPublicPortfoliosParams
): Promise<PublicPortfolioListItem[]> {
  const searchParams = new URLSearchParams();

  if (params?.name) {
    searchParams.set('name', params.name);
  }

  if (params?.userName) {
    searchParams.set('userName', params.userName);
  }

  if (params?.sortBy) {
    searchParams.set('sortBy', params.sortBy);
  }

  const queryString = searchParams.toString();
  const path = queryString ? `/portfolios/public?${queryString}` : '/portfolios/public';

  const response = await apiClient.get<PublicPortfolioListItem[]>(path);
  return response.data;
}

/**
 * Get a single (private) portfolio by id for the current user.
 */
export async function getPortfolio(id: string): Promise<PortfolioListItem> {
  const response = await apiClient.get<PortfolioListItem>(`/portfolios/${id}`);
  return response.data;
}

/**
 * Get a single public portfolio by id.
 * Accessible without authentication.
 */
export async function getPublicPortfolio(
  id: string
): Promise<PublicPortfolioListItem> {
  const response = await apiClient.get<PublicPortfolioListItem>(
    `/portfolios/public/${id}`
  );
  return response.data;
}

/**
 * Update an existing portfolio.
 */
export async function updatePortfolio(
  id: string,
  body: UpdatePortfolioRequest
): Promise<PortfolioListItem> {
  const response = await apiClient.patch<PortfolioListItem>(`/portfolios/${id}`, body);
  return response.data;
}

/**
 * Delete a portfolio.
 */
export async function deletePortfolio(id: string): Promise<void> {
  await apiClient.delete(`/portfolios/${id}`);
}
