/**
 * Centralized query keys for React Query.
 * Ensures consistent cache key management across the application.
 *
 * Pattern: [domain, ...params]
 * - Use arrays for hierarchical cache invalidation
 * - All functions return readonly arrays for type safety
 */

export const queryKeys = {
  /**
   * Asset-related query keys
   */
  assets: {
    /** Root key for all asset queries */
    all: ['assets'] as const,
    /** Key for a specific asset by ID */
    byId: (id: string) => ['assets', 'byId', id] as const,
    /** Key for asset resolution queries */
    resolve: (identifier: string) => ['assets', 'resolve', identifier] as const,
  },

  /**
   * X-Ray generation query keys
   */
  xray: {
    /** Root key for all X-Ray queries */
    all: ['xray'] as const,
    /** Key for a specific X-Ray generation */
    generate: (assetIds: string[]) =>
      ['xray', 'generate', ...assetIds.sort()] as const,
  },
} as const;

/**
 * Type helper for extracting query key types
 */
export type QueryKeys = typeof queryKeys;
