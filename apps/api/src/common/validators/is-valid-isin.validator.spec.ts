import { IsValidIsinConstraint } from './is-valid-isin.validator';

describe('IsValidIsinConstraint', () => {
  let validator: IsValidIsinConstraint;

  beforeEach(() => {
    validator = new IsValidIsinConstraint();
  });

  describe('validate', () => {
    describe('valid ISINs', () => {
      it('should return true for valid Irish ISIN (IE00B4L5Y983)', () => {
        expect(validator.validate('IE00B4L5Y983')).toBe(true);
      });

      it('should return true for valid US ISIN (US0378331005 - Apple)', () => {
        expect(validator.validate('US0378331005')).toBe(true);
      });

      it('should return true for valid German ISIN (DE0007164600 - SAP)', () => {
        expect(validator.validate('DE0007164600')).toBe(true);
      });

      it('should return true for valid GB ISIN (GB0002374006)', () => {
        expect(validator.validate('GB0002374006')).toBe(true);
      });

      it('should return true for valid French ISIN (FR0000120271)', () => {
        expect(validator.validate('FR0000120271')).toBe(true);
      });

      it('should handle lowercase ISIN and validate correctly', () => {
        expect(validator.validate('ie00b4l5y983')).toBe(true);
      });
    });

    describe('invalid ISINs', () => {
      it('should return false for ISIN with wrong check digit', () => {
        // IE00B4L5Y983 is valid, IE00B4L5Y984 has wrong check digit
        expect(validator.validate('IE00B4L5Y984')).toBe(false);
      });

      it('should return false for garbage string (CANADAFRENCH)', () => {
        // This is a real case from Morningstar API returning garbage
        expect(validator.validate('CANADAFRENCH')).toBe(false);
      });

      it('should return false for too short string', () => {
        expect(validator.validate('IE00B4L5Y98')).toBe(false);
      });

      it('should return false for too long string', () => {
        expect(validator.validate('IE00B4L5Y9833')).toBe(false);
      });

      it('should return false for Morningstar ID', () => {
        expect(validator.validate('0P0000YXJO')).toBe(false);
      });

      it('should return false for ticker symbol', () => {
        expect(validator.validate('AAPL')).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(validator.validate('')).toBe(false);
      });

      it('should return false for numeric-only string', () => {
        expect(validator.validate('123456789012')).toBe(false);
      });
    });

    describe('non-string values', () => {
      it('should return false for number', () => {
        expect(validator.validate(12345 as unknown)).toBe(false);
      });

      it('should return false for null', () => {
        expect(validator.validate(null)).toBe(false);
      });

      it('should return false for undefined', () => {
        expect(validator.validate(undefined)).toBe(false);
      });

      it('should return false for object', () => {
        expect(validator.validate({ isin: 'IE00B4L5Y983' })).toBe(false);
      });

      it('should return false for array', () => {
        expect(validator.validate(['IE00B4L5Y983'])).toBe(false);
      });

      it('should return false for boolean', () => {
        expect(validator.validate(true as unknown)).toBe(false);
      });
    });
  });

  describe('defaultMessage', () => {
    it('should return the correct error message', () => {
      const message = validator.defaultMessage();
      expect(message).toContain('Invalid ISIN');
      expect(message).toContain('2 letters');
      expect(message).toContain('10 alphanumeric');
    });
  });
});
