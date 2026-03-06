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

  /**
   * Portfolios (saved) query keys
   */
  portfolios: {
    /** Root key for all portfolio queries */
    all: ['portfolios'] as const,
    /** Key for a specific portfolio by id */
    byId: (id: string) => ['portfolios', id] as const,
    /** Key for public portfolios explorer list */
    publicList: (filters: {
      name?: string;
      userName?: string;
      sortBy?: string;
    } = {}) => ['portfolios', 'public', filters] as const,
    /** Key for a single public portfolio by id */
    publicById: (id: string) =>
      ['portfolios', 'public', 'byId', id] as const,
  },

  /**
   * Favorites query keys
   */
  favorites: {
    /** Root key for current user favorites list */
    all: ['favorites'] as const,
  },
} as const;

/**
 * Type helper for extracting query key types
 */
export type QueryKeys = typeof queryKeys;
