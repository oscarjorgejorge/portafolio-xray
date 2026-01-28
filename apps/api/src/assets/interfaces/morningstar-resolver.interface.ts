import { ResolutionResult } from '../resolver/resolver.types';

/**
 * Morningstar Resolver Interface
 * Defines the contract for resolving asset identifiers to Morningstar IDs
 */
export interface IMorningstarResolver {
  /**
   * Resolve an asset identifier to Morningstar ID
   * Uses multiple search strategies, scoring, and page verification
   * @param input - ISIN, Morningstar ID, ticker, or free text
   * @returns Resolution result with confidence score
   */
  resolve(input: string): Promise<ResolutionResult>;
}

/**
 * Injection token for IMorningstarResolver
 */
export const MORNINGSTAR_RESOLVER = Symbol('MORNINGSTAR_RESOLVER');
