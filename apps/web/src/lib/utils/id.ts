/**
 * Generate a unique ID for client-side use only
 * This should only be called in client components after mount
 */
let idCounter = 0;

export function generateId(): string {
  idCounter += 1;
  return `id-${idCounter}-${Date.now()}`;
}

/**
 * Generate a simple unique ID using crypto if available, otherwise fallback
 * Safe for client-side use only
 */
export function generateSimpleId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  idCounter += 1;
  return `id-${idCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

