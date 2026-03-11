import { apiClient } from './client';

export interface CommentUserSummary {
  id: string;
  userName: string;
  name: string;
}

export interface CommentItem {
  id: string;
  portfolioId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: CommentUserSummary;
  isOwnedByCurrentUser?: boolean;
}

export async function getPortfolioComments(
  portfolioId: string,
): Promise<CommentItem[]> {
  const response = await apiClient.get<CommentItem[]>(
    `/portfolios/${portfolioId}/comments`,
  );
  return response.data;
}

export async function createComment(
  portfolioId: string,
  content: string,
): Promise<CommentItem> {
  const response = await apiClient.post<CommentItem>(
    `/portfolios/${portfolioId}/comments`,
    { content },
  );
  return response.data;
}

export async function updateComment(
  portfolioId: string,
  id: string,
  content: string,
): Promise<CommentItem> {
  const response = await apiClient.patch<CommentItem>(
    `/portfolios/${portfolioId}/comments/${id}`,
    { content },
  );
  return response.data;
}

export async function deleteComment(
  portfolioId: string,
  id: string,
): Promise<void> {
  await apiClient.delete<void>(`/portfolios/${portfolioId}/comments/${id}`);
}

