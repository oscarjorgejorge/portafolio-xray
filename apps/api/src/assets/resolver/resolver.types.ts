/**
 * Morningstar Resolver Types
 * Ported from POC for API integration
 */

// Input type classification
export type InputType = 'ISIN' | 'MORNINGSTAR_ID' | 'TICKER' | 'FREE_TEXT';

// Asset type according to Morningstar
export type MorningstarAssetType = 'Fondo' | 'ETF' | 'Accion' | 'Desconocido';

// Individual search result
export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  morningstarId: string | null;
  domain: string;
  ticker?: string;
  assetType?: MorningstarAssetType;
  rawType?: string;
}

// Result with scoring
export interface ScoredResult extends SearchResult {
  score: number;
  scoreBreakdown: {
    isinMatch: number;
    tickerMatch: number;
    nameMatch: number;
    morningstarDomain: number;
    typeMatch: number;
  };
}

// Verification result from page scraping
export interface VerificationResult {
  verified: boolean;
  isinFound: string | null;
  nameFound: string | null;
  additionalInfo: Record<string, string>;
}

// Final resolution result
export interface ResolutionResult {
  input: string;
  inputType: InputType;
  normalizedInput: string;
  timestamp: string;
  status: 'resolved' | 'needs_review' | 'not_found';
  confidence: number;
  bestMatch: ScoredResult | null;
  allResults: ScoredResult[];
  morningstarId: string | null;
  morningstarUrl: string | null;
  verification?: VerificationResult;
}

// Resolver configuration
export interface ResolverConfig {
  searchDelay: number;
  maxResults: number;
  minConfidence: number;
  domains: string[];
}

