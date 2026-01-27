/**
 * Validation constants used across the application
 * Centralizes magic numbers for maintainability and consistency
 */

/**
 * Portfolio weight validation constants
 */
export const WEIGHT_VALIDATION = {
  /** Target total weight percentage for a valid portfolio */
  TARGET_TOTAL: 100,
  /** Tolerance for floating point comparison (0.01 = 0.01% tolerance) */
  TOLERANCE: 0.01,
  /** Minimum weight per asset */
  MIN_WEIGHT: 0,
  /** Maximum weight per asset */
  MAX_WEIGHT: 100,
} as const;

/**
 * Resolution confidence thresholds
 * Used to determine if a result needs manual review
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Minimum confidence to auto-resolve without review */
  MIN_AUTO_RESOLVE: 0.7,
  /** High confidence threshold (near certain match) */
  HIGH_CONFIDENCE: 0.9,
  /** Low confidence threshold (likely needs review) */
  LOW_CONFIDENCE: 0.5,
} as const;

/**
 * Input validation constants
 */
export const INPUT_VALIDATION = {
  /** Maximum length for Morningstar ID */
  MAX_MORNINGSTAR_ID_LENGTH: 20,
  /** Maximum length for generic input identifier (ISIN, ticker, etc.) */
  MAX_INPUT_LENGTH: 50,
  /** Maximum length for asset name */
  MAX_ASSET_NAME_LENGTH: 255,
  /** Maximum length for ticker symbol */
  MAX_TICKER_LENGTH: 20,
  /** Maximum length for URL */
  MAX_URL_LENGTH: 500,
  /** Maximum assets in batch resolve */
  MAX_BATCH_SIZE: 20,
  /** Minimum assets in a request */
  MIN_BATCH_SIZE: 1,
} as const;

/**
 * Cache configuration constants
 */
export const CACHE_CONFIG = {
  /** Prefix for asset resolution cache keys */
  ASSET_KEY_PREFIX: 'asset:',
} as const;

/**
 * Morningstar URL building constants
 */
export const MORNINGSTAR_URL = {
  /** X-Ray PDF endpoint path */
  XRAY_PATH: '/j2uwuwirpv/xraypdf/default.aspx',
  /** Default language ID for URLs */
  LANGUAGE_ID: 'es-ES',
  /** Portfolio type for X-Ray */
  PORTFOLIO_TYPE: '2',
  /** Weight multiplier (percentage to basis points) */
  WEIGHT_MULTIPLIER: 100,
  /** Security token suffix */
  SECURITY_TOKEN_SUFFIX: '$$ALL_1340',
} as const;
