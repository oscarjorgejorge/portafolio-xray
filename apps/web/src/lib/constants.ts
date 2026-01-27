/**
 * Centralized constants for the web application.
 * Avoids magic numbers and strings scattered throughout the codebase.
 */

// ============================================
// Polling Configuration
// ============================================

export const POLLING = {
  /** Interval between polling attempts in milliseconds */
  INTERVAL_MS: 5000,
  /** Maximum number of polling attempts before giving up */
  MAX_ATTEMPTS: 6,
  /** Initial delay before first poll in milliseconds */
  INITIAL_DELAY_MS: 1000,
} as const;

// ============================================
// UI Feedback Durations
// ============================================

export const UI_FEEDBACK = {
  /** Duration to show copy confirmation in milliseconds */
  COPY_FEEDBACK_DURATION_MS: 2000,
  /** Duration to show success toast in milliseconds */
  TOAST_DURATION_MS: 3000,
} as const;

// ============================================
// Portfolio Validation
// ============================================

export const VALIDATION = {
  /** Target total percentage for portfolio weights */
  PERCENTAGE_TOTAL: 100,
  /** Tolerance for percentage validation (0.01 = 1%) */
  PERCENTAGE_TOLERANCE: 0.01,
  /** Minimum valid ISIN length */
  ISIN_LENGTH: 12,
} as const;

// ============================================
// API Configuration
// ============================================

export const API = {
  /** Default timeout for API requests in milliseconds */
  TIMEOUT_MS: 30000,
  /** Stale time for React Query cache in milliseconds (1 minute) */
  STALE_TIME_MS: 60 * 1000,
  /** Number of retry attempts for failed requests */
  RETRY_COUNT: 1,
} as const;

// ============================================
// Asset Types
// ============================================

export const ASSET_TYPES = ['ETF', 'FUND', 'STOCK', 'ETC'] as const;

export type AssetTypeValue = (typeof ASSET_TYPES)[number];
