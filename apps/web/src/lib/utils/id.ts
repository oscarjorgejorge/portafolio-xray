/**
 * ID Generation Utilities
 *
 * When to use each:
 *
 * 1. `useId()` from React (preferred for accessibility):
 *    - For DOM element IDs (htmlFor, aria-labelledby, aria-describedby)
 *    - Stable across server/client renders (SSR-safe)
 *    - Use inside React components only
 *
 * 2. `generateSimpleId()` (for data IDs):
 *    - For creating unique identifiers for data objects (e.g., portfolio assets)
 *    - Can be called anywhere (callbacks, effects, outside components)
 *    - NOT suitable for DOM accessibility attributes
 *
 * @example
 * // For accessibility (use useId from React)
 * import { useId } from 'react';
 * const inputId = useId();
 * <label htmlFor={inputId}>Name</label>
 * <input id={inputId} />
 *
 * // For data IDs (use generateSimpleId)
 * import { generateSimpleId } from '@/lib/utils/id';
 * const newAsset = { id: generateSimpleId(), name: 'Asset' };
 */

let idCounter = 0;

/**
 * Generate a unique ID for client-side use only.
 * Uses crypto.randomUUID() when available for better uniqueness.
 *
 * @returns A unique string identifier (UUID format when crypto available)
 */
export function generateSimpleId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  idCounter += 1;
  return `id-${idCounter}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * @deprecated Use `generateSimpleId()` instead or `useId()` from React for DOM IDs
 */
export function generateId(): string {
  idCounter += 1;
  return `id-${idCounter}-${Date.now()}`;
}

