// Tipos de input detectados
export type InputType = 'ISIN' | 'MORNINGSTAR_ID' | 'TICKER' | 'FREE_TEXT';

// Tipo de activo según Morningstar
export type AssetType = 'Fondo' | 'ETF' | 'Accion' | 'Desconocido';

// Resultado de búsqueda individual
export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  morningstarId: string | null;
  domain: string;
  ticker?: string;       // Para matching de tickers
  assetType?: AssetType; // Tipo de activo (Fondo, ETF, Accion)
  rawType?: string;      // Tipo crudo de la API (FO, ST, CE, etc.)
}

// Resultado con scoring
export interface ScoredResult extends SearchResult {
  score: number;
  scoreBreakdown: {
    isinMatch: number;
    tickerMatch: number;  // Nuevo: para match de ticker
    nameMatch: number;
    morningstarDomain: number;
    typeMatch: number;
  };
}

// Resultado de verificación
export interface VerificationResult {
  verified: boolean;
  isinFound: string | null;
  nameFound: string | null;
  additionalInfo: Record<string, string>;
}

// Resultado final de resolución
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
  verification?: VerificationResult;  // Añadido correctamente al tipo
}

// Configuración
export interface ResolverConfig {
  searchDelay: number;
  maxResults: number;
  minConfidence: number;
  domains: string[];
}
