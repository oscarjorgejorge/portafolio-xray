import {
  extractMorningstarId,
  extractDomain,
  isValidIsin,
} from './id-extractor';

describe('id-extractor utils', () => {
  describe('extractMorningstarId', () => {
    describe('Spanish fund URLs (/fondos/)', () => {
      it('should extract F-prefixed ID from Spanish fund URL', () => {
        const url =
          'https://www.morningstar.es/es/funds/snapshot/snapshot.aspx?id=F00000THA5';
        expect(extractMorningstarId(url)).toBe('F00000THA5');
      });

      it('should extract ID from /fondos/ path', () => {
        const url = 'https://www.morningstar.es/es/fondos/F00000THA5/overview';
        expect(extractMorningstarId(url)).toBe('F00000THA5');
      });
    });

    describe('English fund URLs (/funds/)', () => {
      it('should extract ID from /funds/ path', () => {
        const url =
          'https://www.morningstar.com/funds/xnas/F00000THA5/portfolio';
        expect(extractMorningstarId(url)).toBe('F00000THA5');
      });

      it('should extract 0P-prefixed ID from fund URL', () => {
        const url = 'https://www.morningstar.com/funds/xnas/0P0000YXJO/quote';
        expect(extractMorningstarId(url)).toBe('0P0000YXJO');
      });
    });

    describe('ETF URLs (/etfs/)', () => {
      it('should extract ID from /etfs/ path', () => {
        const url = 'https://www.morningstar.com/etfs/arcx/F00000WXYZ/quote';
        expect(extractMorningstarId(url)).toBe('F00000WXYZ');
      });

      it('should extract ID from global ETF URL', () => {
        const url =
          'https://global.morningstar.com/etfs/xetr/F000016RL3/portfolio';
        expect(extractMorningstarId(url)).toBe('F000016RL3');
      });
    });

    describe('Query parameter URLs', () => {
      it('should extract ID from ?id= parameter', () => {
        const url =
          'https://www.morningstar.es/es/funds/snapshot/snapshot.aspx?id=F00000THA5';
        expect(extractMorningstarId(url)).toBe('F00000THA5');
      });

      it('should extract ID from &id= parameter', () => {
        const url =
          'https://www.morningstar.es/es/funds?tab=portfolio&id=0P0000YXJO';
        expect(extractMorningstarId(url)).toBe('0P0000YXJO');
      });
    });

    describe('0P-prefixed IDs', () => {
      it('should extract 0P format ID', () => {
        const url = 'https://www.morningstar.es/es/funds/0P0000YXJO/portfolio';
        expect(extractMorningstarId(url)).toBe('0P0000YXJO');
      });

      it('should extract 0P format from text', () => {
        const url = 'Check fund 0P000168Z7 for details';
        expect(extractMorningstarId(url)).toBe('0P000168Z7');
      });
    });

    describe('F0-prefixed IDs', () => {
      it('should extract F000 format ID', () => {
        const url = 'https://www.morningstar.es/es/funds/F000016RL3/overview';
        expect(extractMorningstarId(url)).toBe('F000016RL3');
      });

      it('should extract F00000 format ID', () => {
        const url = 'https://www.morningstar.es/es/funds/F00000THA5/overview';
        expect(extractMorningstarId(url)).toBe('F00000THA5');
      });
    });

    describe('Edge cases', () => {
      it('should return null for empty string', () => {
        expect(extractMorningstarId('')).toBeNull();
      });

      it('should return null for null/undefined input', () => {
        expect(extractMorningstarId(null as unknown as string)).toBeNull();
        expect(extractMorningstarId(undefined as unknown as string)).toBeNull();
      });

      it('should return null for URL without Morningstar ID', () => {
        const url = 'https://www.google.com/search?q=vanguard+fund';
        expect(extractMorningstarId(url)).toBeNull();
      });

      it('should return null for URL with ISIN (not Morningstar ID)', () => {
        const url = 'https://www.morningstar.es/es/funds/IE00B4L5Y983/overview';
        expect(extractMorningstarId(url)).toBeNull();
      });

      it('should handle lowercase ID and return uppercase', () => {
        const url = 'https://www.morningstar.es/es/funds/f00000tha5/overview';
        expect(extractMorningstarId(url)).toBe('F00000THA5');
      });
    });
  });

  describe('extractDomain', () => {
    describe('valid URLs', () => {
      it('should extract domain from https URL', () => {
        expect(
          extractDomain('https://www.morningstar.es/es/funds/snapshot'),
        ).toBe('morningstar.es');
      });

      it('should extract domain from http URL', () => {
        expect(extractDomain('http://morningstar.com/funds')).toBe(
          'morningstar.com',
        );
      });

      it('should remove www. prefix', () => {
        expect(extractDomain('https://www.google.com/search')).toBe(
          'google.com',
        );
      });

      it('should handle subdomains', () => {
        expect(extractDomain('https://global.morningstar.com/funds')).toBe(
          'global.morningstar.com',
        );
      });

      it('should handle URLs with ports', () => {
        expect(extractDomain('http://localhost:3000/api')).toBe('localhost');
      });
    });

    describe('edge cases', () => {
      it('should return empty string for empty input', () => {
        expect(extractDomain('')).toBe('');
      });

      it('should return empty string for null/undefined', () => {
        expect(extractDomain(null as unknown as string)).toBe('');
        expect(extractDomain(undefined as unknown as string)).toBe('');
      });

      it('should return empty string for invalid URL', () => {
        expect(extractDomain('not a url')).toBe('');
      });

      it('should return empty string for truly malformed URL', () => {
        expect(extractDomain('not a url at all')).toBe('');
      });
    });
  });

  describe('isValidIsin', () => {
    describe('valid ISINs', () => {
      it('should return true for Luxembourg ISIN (LU)', () => {
        expect(isValidIsin('LU0996182563')).toBe(true);
      });

      it('should return true for Irish ISIN (IE)', () => {
        expect(isValidIsin('IE00B4L5Y983')).toBe(true);
      });

      it('should return true for German ISIN (DE)', () => {
        expect(isValidIsin('DE0007164600')).toBe(true);
      });

      it('should return true for US ISIN (US)', () => {
        expect(isValidIsin('US0378331005')).toBe(true);
      });

      it('should return true for GB ISIN (GB)', () => {
        expect(isValidIsin('GB0002374006')).toBe(true);
      });

      it('should return true for French ISIN (FR)', () => {
        expect(isValidIsin('FR0000120271')).toBe(true);
      });

      it('should return true for Spanish ISIN (ES)', () => {
        expect(isValidIsin('ES0113900J37')).toBe(true);
      });
    });

    describe('invalid ISINs', () => {
      it('should return false for string with invalid prefix', () => {
        expect(isValidIsin('XX1234567890')).toBe(false);
      });

      it('should return false for Morningstar ID (0P)', () => {
        expect(isValidIsin('0P0000YXJO12')).toBe(false);
      });

      it('should return false for Morningstar ID (F0)', () => {
        expect(isValidIsin('F00000THA512')).toBe(false);
      });

      it('should return false for string too short', () => {
        expect(isValidIsin('IE00B4L5Y98')).toBe(false);
      });

      it('should return false for string too long', () => {
        expect(isValidIsin('IE00B4L5Y9833')).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(isValidIsin('')).toBe(false);
      });

      it('should return false for null/undefined', () => {
        expect(isValidIsin(null as unknown as string)).toBe(false);
        expect(isValidIsin(undefined as unknown as string)).toBe(false);
      });

      it('should return false for ticker', () => {
        expect(isValidIsin('AAPL')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle lowercase prefixes', () => {
        // Note: The function uses substring(0,2).toUpperCase() so lowercase should work
        expect(isValidIsin('lu0996182563')).toBe(true);
      });

      it('should reject strings that look like ISINs but have unknown prefix', () => {
        expect(isValidIsin('ZZ1234567890')).toBe(false);
      });
    });
  });
});
