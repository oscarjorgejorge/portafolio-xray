/**
 * Unified identifier type enum
 * Used across the application for consistent type classification
 */
export enum IdentifierType {
  ISIN = 'ISIN',
  MORNINGSTAR_ID = 'MORNINGSTAR_ID',
  TICKER = 'TICKER',
  FREE_TEXT = 'FREE_TEXT',
}

/**
 * Centralized identifier classification and validation utilities
 * Provides consistent input normalization and type detection across the API
 */
export class IdentifierClassifier {
  // ISIN: 2 letters (country code) + 10 alphanumeric characters
  private static readonly ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{10}$/;

  // Morningstar ID patterns:
  // - 0P followed by 8 alphanumeric (e.g., 0P00018NVI)
  // - F0 followed by alphanumeric (funds, e.g., F00000THA5)
  private static readonly MS_ID_REGEX = /^(0P[A-Z0-9]{8}|F0[A-Z0-9]{8,10})$/i;

  // Ticker: 1-5 uppercase letters
  private static readonly TICKER_REGEX = /^[A-Z]{1,5}$/;

  /**
   * Normalize input string for consistent processing
   * Trims whitespace, converts to uppercase, and normalizes multiple spaces
   */
  static normalizeInput(input: string): string {
    return input.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  /**
   * Classify the type of identifier
   * Detects ISIN, Morningstar ID, Ticker, or Free Text
   */
  static classify(input: string): IdentifierType {
    const normalized = this.normalizeInput(input);

    if (this.isISIN(normalized)) {
      return IdentifierType.ISIN;
    }

    if (this.isMorningstarId(normalized)) {
      return IdentifierType.MORNINGSTAR_ID;
    }

    if (this.isTicker(normalized)) {
      return IdentifierType.TICKER;
    }

    return IdentifierType.FREE_TEXT;
  }

  /**
   * Check if input is a valid ISIN format
   */
  static isISIN(input: string): boolean {
    return this.ISIN_REGEX.test(input.toUpperCase());
  }

  /**
   * Check if input is a valid Morningstar ID format
   */
  static isMorningstarId(input: string): boolean {
    return this.MS_ID_REGEX.test(input.toUpperCase());
  }

  /**
   * Check if input looks like a stock ticker (1-5 uppercase letters)
   */
  static isTicker(input: string): boolean {
    return this.TICKER_REGEX.test(input.toUpperCase());
  }

  /**
   * Validate ISIN checksum (ISO 6166)
   * Returns true if the ISIN has a valid check digit
   */
  static validateISINChecksum(isin: string): boolean {
    if (!this.isISIN(isin)) {
      return false;
    }

    const normalized = isin.toUpperCase();

    // Convert letters to numbers (A=10, B=11, ..., Z=35)
    let digits = '';
    for (const char of normalized) {
      if (char >= 'A' && char <= 'Z') {
        digits += (char.charCodeAt(0) - 55).toString();
      } else {
        digits += char;
      }
    }

    // Luhn algorithm
    let sum = 0;
    let isSecond = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let d = parseInt(digits[i], 10);

      if (isSecond) {
        d *= 2;
        if (d > 9) {
          d -= 9;
        }
      }

      sum += d;
      isSecond = !isSecond;
    }

    return sum % 10 === 0;
  }
}
