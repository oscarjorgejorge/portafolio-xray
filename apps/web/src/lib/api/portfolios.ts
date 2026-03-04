import { apiClient } from './client';

export interface PortfolioAsset {
  morningstarId: string;
  weight: number;
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
 * Get a single portfolio by id.
 */
export async function getPortfolio(id: string): Promise<PortfolioListItem> {
  const response = await apiClient.get<PortfolioListItem>(`/portfolios/${id}`);
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
