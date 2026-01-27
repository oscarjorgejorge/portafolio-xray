import { SearchResult } from '../resolver.types';

/**
 * Interface for search strategies
 * All search strategies must implement this interface
 */
export interface SearchStrategy {
  /**
   * Name of the strategy for logging purposes
   */
  readonly name: string;

  /**
   * Execute the search and return results
   * @param query - The search query
   * @returns Promise with search results
   */
  search(query: string): Promise<SearchResult[]>;
}
