import { IdentifierClassifier, IdentifierType } from './identifier-classifier';

describe('IdentifierClassifier', () => {
  describe('normalizeInput', () => {
    it('should trim leading and trailing whitespace', () => {
      expect(IdentifierClassifier.normalizeInput('  IE00B4L5Y983  ')).toBe(
        'IE00B4L5Y983',
      );
    });

    it('should convert to uppercase', () => {
      expect(IdentifierClassifier.normalizeInput('ie00b4l5y983')).toBe(
        'IE00B4L5Y983',
      );
    });

    it('should normalize multiple spaces to single space', () => {
      expect(IdentifierClassifier.normalizeInput('Vanguard   FTSE   100')).toBe(
        'VANGUARD FTSE 100',
      );
    });

    it('should handle empty string', () => {
      expect(IdentifierClassifier.normalizeInput('')).toBe('');
    });

    it('should handle string with only spaces', () => {
      expect(IdentifierClassifier.normalizeInput('   ')).toBe('');
    });
  });

  describe('isISIN', () => {
    it('should return true for valid Irish ISIN', () => {
      expect(IdentifierClassifier.isISIN('IE00B4L5Y983')).toBe(true);
    });

    it('should return true for valid Luxembourg ISIN', () => {
      expect(IdentifierClassifier.isISIN('LU0996182563')).toBe(true);
    });

    it('should return true for valid US ISIN', () => {
      expect(IdentifierClassifier.isISIN('US0378331005')).toBe(true);
    });

    it('should return true for valid Spanish ISIN', () => {
      expect(IdentifierClassifier.isISIN('ES0113900J37')).toBe(true);
    });

    it('should return true for valid GB ISIN', () => {
      expect(IdentifierClassifier.isISIN('GB0002374006')).toBe(true);
    });

    it('should return false for string too short', () => {
      expect(IdentifierClassifier.isISIN('IE00B4L5Y98')).toBe(false);
    });

    it('should return false for string too long', () => {
      expect(IdentifierClassifier.isISIN('IE00B4L5Y9833')).toBe(false);
    });

    it('should return false for invalid country code (numbers)', () => {
      expect(IdentifierClassifier.isISIN('12AB12345678')).toBe(false);
    });

    it('should return false for Morningstar ID format', () => {
      expect(IdentifierClassifier.isISIN('0P0000YXJO')).toBe(false);
    });

    it('should handle lowercase and return true for valid ISIN', () => {
      expect(IdentifierClassifier.isISIN('ie00b4l5y983')).toBe(true);
    });
  });

  describe('isMorningstarId', () => {
    it('should return true for 0P format ID', () => {
      expect(IdentifierClassifier.isMorningstarId('0P0000YXJO')).toBe(true);
    });

    it('should return true for F0 format ID (fund)', () => {
      expect(IdentifierClassifier.isMorningstarId('F00000THA5')).toBe(true);
    });

    it('should return true for longer F0 format ID', () => {
      expect(IdentifierClassifier.isMorningstarId('F000016RL3')).toBe(true);
    });

    it('should return false for ISIN format', () => {
      expect(IdentifierClassifier.isMorningstarId('IE00B4L5Y983')).toBe(false);
    });

    it('should return false for ticker format', () => {
      expect(IdentifierClassifier.isMorningstarId('AAPL')).toBe(false);
    });

    it('should return false for free text', () => {
      expect(IdentifierClassifier.isMorningstarId('Vanguard FTSE')).toBe(false);
    });

    it('should handle lowercase and return true', () => {
      expect(IdentifierClassifier.isMorningstarId('0p0000yxjo')).toBe(true);
    });
  });

  describe('isTicker', () => {
    it('should return true for 1 letter ticker', () => {
      expect(IdentifierClassifier.isTicker('A')).toBe(true);
    });

    it('should return true for 4 letter ticker', () => {
      expect(IdentifierClassifier.isTicker('AAPL')).toBe(true);
    });

    it('should return true for 5 letter ticker', () => {
      expect(IdentifierClassifier.isTicker('GOOGL')).toBe(true);
    });

    it('should return false for 6+ letter string', () => {
      expect(IdentifierClassifier.isTicker('GOOGLE')).toBe(false);
    });

    it('should return false for string with numbers', () => {
      expect(IdentifierClassifier.isTicker('AAP1')).toBe(false);
    });

    it('should return false for string with spaces', () => {
      expect(IdentifierClassifier.isTicker('AA PL')).toBe(false);
    });

    it('should handle lowercase and return true', () => {
      expect(IdentifierClassifier.isTicker('aapl')).toBe(true);
    });
  });

  describe('classify', () => {
    describe('ISIN classification', () => {
      it('should classify Irish ISIN correctly', () => {
        expect(IdentifierClassifier.classify('IE00B4L5Y983')).toBe(
          IdentifierType.ISIN,
        );
      });

      it('should classify Luxembourg ISIN correctly', () => {
        expect(IdentifierClassifier.classify('LU0996182563')).toBe(
          IdentifierType.ISIN,
        );
      });

      it('should classify lowercase ISIN correctly', () => {
        expect(IdentifierClassifier.classify('ie00b4l5y983')).toBe(
          IdentifierType.ISIN,
        );
      });

      it('should classify ISIN with leading/trailing spaces correctly', () => {
        expect(IdentifierClassifier.classify('  IE00B4L5Y983  ')).toBe(
          IdentifierType.ISIN,
        );
      });
    });

    describe('Morningstar ID classification', () => {
      it('should classify 0P format ID correctly', () => {
        expect(IdentifierClassifier.classify('0P0000YXJO')).toBe(
          IdentifierType.MORNINGSTAR_ID,
        );
      });

      it('should classify F0 format ID correctly', () => {
        expect(IdentifierClassifier.classify('F00000THA5')).toBe(
          IdentifierType.MORNINGSTAR_ID,
        );
      });

      it('should classify lowercase Morningstar ID correctly', () => {
        expect(IdentifierClassifier.classify('0p0000yxjo')).toBe(
          IdentifierType.MORNINGSTAR_ID,
        );
      });
    });

    describe('Ticker classification', () => {
      it('should classify short ticker correctly', () => {
        expect(IdentifierClassifier.classify('AAPL')).toBe(
          IdentifierType.TICKER,
        );
      });

      it('should classify 5-letter ticker correctly', () => {
        expect(IdentifierClassifier.classify('GOOGL')).toBe(
          IdentifierType.TICKER,
        );
      });

      it('should classify single letter ticker correctly', () => {
        expect(IdentifierClassifier.classify('V')).toBe(IdentifierType.TICKER);
      });
    });

    describe('Free text classification', () => {
      it('should classify fund name as FREE_TEXT', () => {
        expect(IdentifierClassifier.classify('Vanguard FTSE All-World')).toBe(
          IdentifierType.FREE_TEXT,
        );
      });

      it('should classify 6+ letter word as FREE_TEXT', () => {
        expect(IdentifierClassifier.classify('GOOGLE')).toBe(
          IdentifierType.FREE_TEXT,
        );
      });

      it('should classify string with numbers in middle as FREE_TEXT', () => {
        expect(IdentifierClassifier.classify('S&P500')).toBe(
          IdentifierType.FREE_TEXT,
        );
      });

      it('should classify empty string as FREE_TEXT', () => {
        expect(IdentifierClassifier.classify('')).toBe(
          IdentifierType.FREE_TEXT,
        );
      });

      it('should classify string with special characters as FREE_TEXT', () => {
        expect(IdentifierClassifier.classify('iShares Core S&P 500')).toBe(
          IdentifierType.FREE_TEXT,
        );
      });
    });
  });

  describe('validateISINChecksum', () => {
    describe('valid ISINs with correct checksum', () => {
      it('should return true for valid Irish ISIN (IE00B4L5Y983)', () => {
        expect(IdentifierClassifier.validateISINChecksum('IE00B4L5Y983')).toBe(
          true,
        );
      });

      it('should return true for valid US ISIN (US0378331005 - Apple)', () => {
        expect(IdentifierClassifier.validateISINChecksum('US0378331005')).toBe(
          true,
        );
      });

      it('should return true for valid GB ISIN (GB0002374006)', () => {
        expect(IdentifierClassifier.validateISINChecksum('GB0002374006')).toBe(
          true,
        );
      });

      it('should return true for valid DE ISIN (DE0007164600 - SAP)', () => {
        expect(IdentifierClassifier.validateISINChecksum('DE0007164600')).toBe(
          true,
        );
      });

      it('should return true for valid FR ISIN (FR0000120271 - Total)', () => {
        expect(IdentifierClassifier.validateISINChecksum('FR0000120271')).toBe(
          true,
        );
      });

      it('should handle lowercase and validate correctly', () => {
        expect(IdentifierClassifier.validateISINChecksum('ie00b4l5y983')).toBe(
          true,
        );
      });
    });

    describe('invalid ISINs', () => {
      it('should return false for ISIN with wrong check digit', () => {
        // IE00B4L5Y983 is valid, IE00B4L5Y984 has wrong check digit
        expect(IdentifierClassifier.validateISINChecksum('IE00B4L5Y984')).toBe(
          false,
        );
      });

      it('should return false for garbage that looks like ISIN (CANADAFRENCH)', () => {
        // This is a real case from Morningstar API returning garbage
        expect(IdentifierClassifier.validateISINChecksum('CANADAFRENCH')).toBe(
          false,
        );
      });

      it('should return false for random 12-char alphanumeric string', () => {
        expect(IdentifierClassifier.validateISINChecksum('AB1234567890')).toBe(
          false,
        );
      });

      it('should return false for string too short', () => {
        expect(IdentifierClassifier.validateISINChecksum('IE00B4L5Y98')).toBe(
          false,
        );
      });

      it('should return false for string too long', () => {
        expect(IdentifierClassifier.validateISINChecksum('IE00B4L5Y9833')).toBe(
          false,
        );
      });

      it('should return false for Morningstar ID', () => {
        expect(IdentifierClassifier.validateISINChecksum('0P0000YXJO')).toBe(
          false,
        );
      });

      it('should return false for empty string', () => {
        expect(IdentifierClassifier.validateISINChecksum('')).toBe(false);
      });

      it('should return false for numeric-only string', () => {
        expect(IdentifierClassifier.validateISINChecksum('123456789012')).toBe(
          false,
        );
      });
    });
  });
});
