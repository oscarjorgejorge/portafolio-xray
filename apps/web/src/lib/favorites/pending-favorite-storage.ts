const PENDING_FAVORITE_KEY = 'pendingFavoritePortfolioId';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function setPendingFavorite(portfolioId: string): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(PENDING_FAVORITE_KEY, portfolioId);
}

export function getPendingFavorite(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  const value = storage.getItem(PENDING_FAVORITE_KEY);
  return value ?? null;
}

export function clearPendingFavorite(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(PENDING_FAVORITE_KEY);
}

