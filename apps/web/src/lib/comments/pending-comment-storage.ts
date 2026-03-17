const PENDING_COMMENT_KEY_PREFIX = 'pendingComment:';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function setPendingComment(portfolioId: string, content: string): void {
  const storage = getStorage();
  if (!storage) return;
  const key = `${PENDING_COMMENT_KEY_PREFIX}${portfolioId}`;
  storage.setItem(key, content);
}

export function getPendingComment(portfolioId: string): string | null {
  const storage = getStorage();
  if (!storage) return null;
  const key = `${PENDING_COMMENT_KEY_PREFIX}${portfolioId}`;
  const value = storage.getItem(key);
  return value ?? null;
}

export function clearPendingComment(portfolioId: string): void {
  const storage = getStorage();
  if (!storage) return;
  const key = `${PENDING_COMMENT_KEY_PREFIX}${portfolioId}`;
  storage.removeItem(key);
}

