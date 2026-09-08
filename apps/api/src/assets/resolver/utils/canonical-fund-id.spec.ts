import { AssetType } from '@prisma/client';
import {
  namesLookSimilar,
  pickPreferredFundAsset,
  getCanonicalFundIdFromAsset,
  isFundLikeType,
  preferShareClassId,
  resolveShareClassId,
  isAssetIdentityComplete,
  needsShareClassEnrichment,
} from './canonical-fund-id';

describe('canonical-fund-id', () => {
  describe('pickPreferredFundAsset', () => {
    it('should prefer the F ID when 0P and F share an ISIN', () => {
      const preferred = pickPreferredFundAsset([
        { morningstarId: '0P00016YQ5' },
        { morningstarId: 'F00000WI0D' },
      ]);
      expect(preferred?.morningstarId).toBe('F00000WI0D');
    });

    it('should prefer a row whose shareClassId is F', () => {
      const preferred = pickPreferredFundAsset([
        { morningstarId: '0P00016YQ5', shareClassId: 'F00000WI0D' },
        { morningstarId: '0P00016YQ6', shareClassId: null },
      ]);
      expect(preferred?.morningstarId).toBe('0P00016YQ5');
    });

    it('should prefer a valid 0P ID over an ISIN stored as morningstarId', () => {
      const preferred = pickPreferredFundAsset([
        { morningstarId: 'ES0114498027' },
        { morningstarId: '0P0001ODL3' },
      ]);
      expect(preferred?.morningstarId).toBe('0P0001ODL3');
    });

    it('should return the first row when no F ID exists', () => {
      const preferred = pickPreferredFundAsset([
        { morningstarId: '0P00016YQ5' },
      ]);
      expect(preferred?.morningstarId).toBe('0P00016YQ5');
    });
  });

  describe('getCanonicalFundIdFromAsset', () => {
    it('should read the stored shareClassId of a 0P fund', () => {
      expect(
        getCanonicalFundIdFromAsset({
          morningstarId: '0P000168OI',
          shareClassId: 'F00000VYOL',
          type: AssetType.FUND,
          url: 'https://global.morningstar.com/es/inversiones/fondos/0P000168OI/cotizacion',
        }),
      ).toBe('F00000VYOL');
    });

    it('should read the F ID from the URL of a 0P fund', () => {
      expect(
        getCanonicalFundIdFromAsset({
          morningstarId: '0P00016YQ5',
          type: AssetType.FUND,
          url: 'https://global.morningstar.com/es/inversiones/fondos/F00000WI0D/cotizacion',
        }),
      ).toBe('F00000WI0D');
    });

    it('should ignore stocks', () => {
      expect(
        getCanonicalFundIdFromAsset({
          morningstarId: '0P0000AAPL',
          type: AssetType.STOCK,
          url: 'https://global.morningstar.com/es/inversiones/acciones/0P0000AAPL/cotizacion',
        }),
      ).toBeNull();
    });
  });

  describe('namesLookSimilar', () => {
    it('should match Azvalor name variants', () => {
      expect(
        namesLookSimilar('AZ Valor INternacional', 'Azvalor Internacional FI'),
      ).toBe(true);
    });

    it('should reject unrelated names', () => {
      expect(namesLookSimilar('Cobas Renta FI', 'Fidelity MSCI World')).toBe(
        false,
      );
    });
  });

  describe('isFundLikeType', () => {
    it('should include funds, ETFs and ETCs', () => {
      expect(isFundLikeType(AssetType.FUND)).toBe(true);
      expect(isFundLikeType(AssetType.ETF)).toBe(true);
      expect(isFundLikeType(AssetType.ETC)).toBe(true);
      expect(isFundLikeType(AssetType.STOCK)).toBe(false);
    });
  });

  describe('preferShareClassId', () => {
    const quoteUrl =
      'https://global.morningstar.com/es/inversiones/fondos/0P000168OI/cotizacion';

    it('should use the F ID scraped from the quote page', () => {
      expect(
        preferShareClassId(
          '0P000168OI',
          AssetType.FUND,
          quoteUrl,
          'F00000VYOL',
        ),
      ).toBe('F00000VYOL');
    });

    it('should keep stocks on their 0P ID', () => {
      expect(
        preferShareClassId(
          '0P0000AAPL',
          AssetType.STOCK,
          'https://global.morningstar.com/es/inversiones/acciones/0P0000AAPL/cotizacion',
          'F00000VYOL',
        ),
      ).toBe('0P0000AAPL');
    });

    it('should keep an existing F ID', () => {
      expect(
        preferShareClassId(
          'F00000WI0D',
          AssetType.FUND,
          quoteUrl,
          'F00000VYOL',
        ),
      ).toBe('F00000WI0D');
    });
  });

  describe('resolveShareClassId', () => {
    const quoteUrl =
      'https://global.morningstar.com/es/inversiones/fondos/0P000168OI/cotizacion';

    it('should return the F ID without replacing the quote ID', () => {
      expect(
        resolveShareClassId(
          '0P000168OI',
          AssetType.FUND,
          quoteUrl,
          'F00000VYOL',
        ),
      ).toBe('F00000VYOL');
    });

    it('should return null for stocks', () => {
      expect(
        resolveShareClassId(
          '0P0000AAPL',
          AssetType.STOCK,
          'https://global.morningstar.com/es/inversiones/acciones/0P0000AAPL/cotizacion',
          'F00000VYOL',
        ),
      ).toBeNull();
    });
  });

  describe('isAssetIdentityComplete', () => {
    it('should require ISIN, quote ID and F share-class ID for funds', () => {
      expect(
        isAssetIdentityComplete({
          isin: 'ES0173311103',
          morningstarId: '0P000168OI',
          shareClassId: 'F00000VYOL',
          type: AssetType.FUND,
        }),
      ).toBe(true);
      expect(
        isAssetIdentityComplete({
          isin: 'ES0173311103',
          morningstarId: '0P000168OI',
          shareClassId: null,
          type: AssetType.FUND,
        }),
      ).toBe(false);
    });

    it('should require ISIN and quote ID for stocks', () => {
      expect(
        isAssetIdentityComplete({
          isin: 'US0378331005',
          morningstarId: '0P0000AAPL',
          shareClassId: null,
          type: AssetType.STOCK,
        }),
      ).toBe(true);
    });

    it('should reject an ISIN stored as the Morningstar ID', () => {
      expect(
        isAssetIdentityComplete({
          isin: 'ES0114498027',
          morningstarId: 'ES0114498027',
          shareClassId: null,
          type: AssetType.FUND,
        }),
      ).toBe(false);
    });
  });

  describe('needsShareClassEnrichment', () => {
    it('should be true for a 0P fund without a persisted F ID', () => {
      expect(
        needsShareClassEnrichment({
          type: AssetType.FUND,
          morningstarId: '0P000168OI',
          shareClassId: null,
          url: 'https://global.morningstar.com/es/inversiones/fondos/0P000168OI/cotizacion',
        }),
      ).toBe(true);
    });

    it('should be false when shareClassId or URL already has an F ID', () => {
      expect(
        needsShareClassEnrichment({
          type: AssetType.FUND,
          morningstarId: '0P000168OI',
          shareClassId: 'F00000VYOL',
          url: 'https://global.morningstar.com/es/inversiones/fondos/0P000168OI/cotizacion',
        }),
      ).toBe(false);
      expect(
        needsShareClassEnrichment({
          type: AssetType.FUND,
          morningstarId: '0P00016YQ5',
          shareClassId: null,
          url: 'https://global.morningstar.com/es/inversiones/fondos/F00000WI0D/cotizacion',
        }),
      ).toBe(false);
    });

    it('should be false for stocks', () => {
      expect(
        needsShareClassEnrichment({
          type: AssetType.STOCK,
          morningstarId: '0P0000AAPL',
          shareClassId: null,
          url: 'https://global.morningstar.com/es/inversiones/acciones/0P0000AAPL/cotizacion',
        }),
      ).toBe(false);
    });
  });
});
