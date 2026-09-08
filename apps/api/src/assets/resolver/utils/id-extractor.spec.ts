import {
  extractMorningstarId,
  extractMorningstarIdFromUrl,
  extractDomain,
  isValidIsin,
  isFundShareClassId,
  isPerformanceId,
  isPersistedMorningstarIdValid,
  extractPreferredFundId,
  extractShareClassIdFromHtml,
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

      it('should extract a 0P ID from a Yahoo Finance symbol', () => {
        expect(extractMorningstarId('0P0001CLDK.F')).toBe('0P0001CLDK');
      });

      it('should extract F0GBR share-class IDs', () => {
        expect(extractMorningstarId('F0GBR04EZP')).toBe('F0GBR04EZP');
      });

      it('should extract ID from a global stock URL', () => {
        expect(
          extractMorningstarId(
            'https://global.morningstar.com/en-ca/investments/stocks/0P000000B7/quote',
          ),
        ).toBe('0P000000B7');
      });

      it('should extract 0P IDs from en-eu quote, chart and ES cotizacion URLs', () => {
        expect(
          extractMorningstarId(
            'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/quote',
          ),
        ).toBe('0P0001CLDK');
        expect(
          extractMorningstarId(
            'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/chart',
          ),
        ).toBe('0P0001CLDK');
        expect(
          extractMorningstarId(
            'https://global.morningstar.com/es/inversiones/fondos/0P0001CLDK/cotizacion',
          ),
        ).toBe('0P0001CLDK');
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

  describe('extractMorningstarIdFromUrl', () => {
    it('should ignore non-Morningstar text', () => {
      expect(extractMorningstarIdFromUrl('0P0001CLDK')).toBeNull();
    });

    it('should extract the ID from a pasted Morningstar quote URL', () => {
      expect(
        extractMorningstarIdFromUrl(
          'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/quote',
        ),
      ).toBe('0P0001CLDK');
    });

    it('should extract the ID from chart and Spanish cotizacion URLs', () => {
      expect(
        extractMorningstarIdFromUrl(
          'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/chart',
        ),
      ).toBe('0P0001CLDK');
      expect(
        extractMorningstarIdFromUrl(
          'https://global.morningstar.com/es/inversiones/fondos/0P0001CLDK/cotizacion',
        ),
      ).toBe('0P0001CLDK');
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

      it('should return false for YEARLOWPRICE CSS keys', () => {
        expect(isValidIsin('YEARLOWPRICE')).toBe(false);
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

  describe('isFundShareClassId / isPerformanceId', () => {
    it('should detect F share-class IDs including F0GBR', () => {
      expect(isFundShareClassId('F00000THA5')).toBe(true);
      expect(isFundShareClassId('F000014TGO')).toBe(true);
      expect(isFundShareClassId('F0GBR04M6M')).toBe(true);
      expect(isFundShareClassId('0P00016YQ5')).toBe(false);
    });

    it('should detect 0P performance IDs', () => {
      expect(isPerformanceId('0P00016YQ5')).toBe(true);
      expect(isPerformanceId('F00000WI0D')).toBe(false);
    });
  });

  describe('isPersistedMorningstarIdValid', () => {
    it('should accept quote and share-class IDs', () => {
      expect(isPersistedMorningstarIdValid('0P0001ODL3')).toBe(true);
      expect(isPersistedMorningstarIdValid('F00000THA5')).toBe(true);
    });

    it('should reject an ISIN stored as a Morningstar ID', () => {
      expect(isPersistedMorningstarIdValid('ES0114498027')).toBe(false);
      expect(isPersistedMorningstarIdValid('LU0328476410')).toBe(false);
    });
  });

  describe('extractPreferredFundId', () => {
    it('should prefer F IDs even when the path contains 0P', () => {
      const url =
        'https://global.morningstar.com/es/inversiones/fondos/0P00016YQ5/cotizacion?id=F00000WI0D';
      expect(extractPreferredFundId(url)).toBe('F00000WI0D');
    });

    it('should extract F from a share-class quote URL', () => {
      const url =
        'https://global.morningstar.com/es/inversiones/fondos/F00000WI0D/cotizacion';
      expect(extractPreferredFundId(url)).toBe('F00000WI0D');
    });

    it('should return null when the URL only has a 0P ID', () => {
      const url =
        'https://global.morningstar.com/es/inversiones/fondos/0P00016YQ5/cotizacion';
      expect(extractPreferredFundId(url)).toBeNull();
    });
  });

  describe('extractShareClassIdFromHtml', () => {
    it('should read the SAL security-id from a 0P quote page', () => {
      const html = `
        <sal-components-mds-container
          security-id="F00000VYOL"
          security-type="FO"
          tab="fund-quote-top"
        ></sal-components-mds-container>
        <a data-linkbinding="F00000VYOL">Renta 4 Multigestión Num. Patr. Glb FI</a>
      `;
      expect(extractShareClassIdFromHtml(html)).toBe('F00000VYOL');
    });

    it('should ignore 0P IDs and CSS hashes that look similar', () => {
      const html = `
        <div id="0P000168OI"></div>
        <style>.F0ACBKPSJNNCA3 { color: red; }</style>
        <sal-components security-id="0P000168OI"></sal-components>
      `;
      expect(extractShareClassIdFromHtml(html)).toBeNull();
    });

    it('should pick the most frequent F security-id', () => {
      const html = `
        <x security-id="F00000AAAA"></x>
        <x security-id="F00000VYOL"></x>
        <x security-id="F00000VYOL"></x>
        <x security-id="F00000VYOL"></x>
      `;
      expect(extractShareClassIdFromHtml(html)).toBe('F00000VYOL');
    });

    it('should read quoted F IDs from www.morningstar.com JSON', () => {
      const html = `
        <script>window.__NUXT__={byId:"F00001019E",name:"Fidelity MSCI World Index Fund EUR P Acc"}</script>
      `;
      expect(extractShareClassIdFromHtml(html)).toBe('F00001019E');
    });
  });
});
