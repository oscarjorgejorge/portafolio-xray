import { describe, it, expect } from 'vitest';
import { validateIsin, normalizeIsin } from './validation';

describe('validateIsin', () => {
  describe('valid ISINs', () => {
    it('should return null for valid ISIN with letters and numbers', () => {
      expect(validateIsin('IE00B4L5Y983')).toBeNull();
    });

    it('should return null for valid ISIN with all letters after country code', () => {
      expect(validateIsin('US0378331005')).toBeNull();
    });

    it('should return null for valid ISIN in lowercase (normalized)', () => {
      expect(validateIsin('ie00b4l5y983')).toBeNull();
    });

    it('should return null for valid ISIN with leading/trailing whitespace', () => {
      expect(validateIsin('  IE00B4L5Y983  ')).toBeNull();
    });

    it('should return null for Luxembourg ISIN', () => {
      expect(validateIsin('LU2485535293')).toBeNull();
    });
  });

  describe('invalid ISINs', () => {
    it('should return error for empty string', () => {
      expect(validateIsin('')).toBe('ISIN is required');
    });

    it('should return error for whitespace only', () => {
      expect(validateIsin('   ')).toBe('ISIN is required');
    });

    it('should return error for ISIN that is too short', () => {
      expect(validateIsin('IE00B4L5Y98')).toBe('ISIN must be exactly 12 characters');
    });

    it('should return error for ISIN that is too long', () => {
      expect(validateIsin('IE00B4L5Y9833')).toBe('ISIN must be exactly 12 characters');
    });

    it('should return error for ISIN starting with numbers', () => {
      expect(validateIsin('12345678901A')).toBe('Invalid ISIN format (e.g., LU2485535293)');
    });

    it('should return error for ISIN with only one letter at start', () => {
      expect(validateIsin('I000B4L5Y983')).toBe('Invalid ISIN format (e.g., LU2485535293)');
    });

    it('should return error for ISIN with special characters', () => {
      expect(validateIsin('IE00B4L5Y98!')).toBe('Invalid ISIN format (e.g., LU2485535293)');
    });

    it('should return error for ISIN with spaces in the middle', () => {
      expect(validateIsin('IE00 B4L5Y98')).toBe('Invalid ISIN format (e.g., LU2485535293)');
    });
  });
});

describe('normalizeIsin', () => {
  it('should trim whitespace', () => {
    expect(normalizeIsin('  IE00B4L5Y983  ')).toBe('IE00B4L5Y983');
  });

  it('should convert to uppercase', () => {
    expect(normalizeIsin('ie00b4l5y983')).toBe('IE00B4L5Y983');
  });

  it('should handle mixed case', () => {
    expect(normalizeIsin('Ie00B4l5Y983')).toBe('IE00B4L5Y983');
  });

  it('should return empty string for empty input', () => {
    expect(normalizeIsin('')).toBe('');
  });
});
