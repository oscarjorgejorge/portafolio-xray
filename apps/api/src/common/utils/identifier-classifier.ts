export enum IdentifierType {
  ISIN = 'ISIN',
  MORNINGSTAR_ID = 'MORNINGSTAR_ID',
  UNKNOWN = 'UNKNOWN',
}

export class IdentifierClassifier {
  // ISIN: 2 letters (country code) + 10 alphanumeric characters
  private static readonly ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{10}$/;

  // Morningstar ID patterns:
  // - 0P followed by 8 alphanumeric (e.g., 0P00018NVI)
  // - F0 followed by alphanumeric (funds)
  private static readonly MS_ID_REGEX = /^(0P[A-Z0-9]{8}|F0[A-Z0-9]{8,10})$/i;

  /**
   * Classify the type of identifier
   */
  static classify(input: string): IdentifierType {
    const normalized = input.trim().toUpperCase();

    if (this.isISIN(normalized)) {
      return IdentifierType.ISIN;
    }

    if (this.isMorningstarId(normalized)) {
      return IdentifierType.MORNINGSTAR_ID;
    }

    return IdentifierType.UNKNOWN;
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
