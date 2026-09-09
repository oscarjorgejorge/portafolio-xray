import { AssetType } from '@prisma/client';
import {
  correctedType,
  planIdentityRepair,
  typeFromQuoteUrl,
} from './identity-repair';

describe('identity-repair', () => {
  describe('typeFromQuoteUrl', () => {
    it('should detect stocks from quote URLs', () => {
      expect(
        typeFromQuoteUrl(
          'https://global.morningstar.com/es/inversiones/acciones/0P00005U6B/cotizacion',
        ),
      ).toBe(AssetType.STOCK);
      expect(
        typeFromQuoteUrl('https://www.morningstar.com/stocks/xnys/ko/quote'),
      ).toBe(AssetType.STOCK);
    });

    it('should detect ETFs from quote URLs', () => {
      expect(
        typeFromQuoteUrl(
          'https://global.morningstar.com/en-eu/investments/etfs/0P0000AB7T/quote',
        ),
      ).toBe(AssetType.ETF);
    });

    it('should return null when the URL has no quote path', () => {
      expect(typeFromQuoteUrl('https://morningstar.es/search')).toBeNull();
      expect(typeFromQuoteUrl(null)).toBeNull();
    });
  });

  describe('correctedType', () => {
    it('should retag funds whose URL is a stock page', () => {
      expect(
        correctedType(
          AssetType.FUND,
          'https://global.morningstar.com/es/inversiones/acciones/0P0001UHI6/cotizacion',
        ),
      ).toBe(AssetType.STOCK);
    });

    it('should retag stocks whose URL is an ETF page', () => {
      expect(
        correctedType(
          AssetType.STOCK,
          'https://global.morningstar.com/es/inversiones/etfs/0P0000WA5N/cotizacion',
        ),
      ).toBe(AssetType.ETF);
    });

    it('should retag funds whose URL is an ETF page', () => {
      expect(
        correctedType(
          AssetType.FUND,
          'https://global.morningstar.com/es/inversiones/etfs/0P0000AB7T/cotizacion',
        ),
      ).toBe(AssetType.ETF);
    });

    it('should not retag ETCs or ETFs pointing at /fondos/', () => {
      expect(
        correctedType(
          AssetType.ETC,
          'https://global.morningstar.com/es/inversiones/etfs/0P0001U18C/cotizacion',
        ),
      ).toBeNull();
      expect(
        correctedType(
          AssetType.ETF,
          'https://global.morningstar.com/es/inversiones/fondos/0P0000WA5N/cotizacion',
        ),
      ).toBeNull();
    });
  });

  describe('planIdentityRepair', () => {
    it('should retag a fund row whose URL is a stock page', () => {
      expect(
        planIdentityRepair({
          id: '1',
          morningstarId: '0P0001UHI6',
          type: AssetType.FUND,
          url: 'https://global.morningstar.com/es/inversiones/acciones/0P0001UHI6/cotizacion',
          name: 'Nike',
        }),
      ).toEqual({ action: 'correct_type', type: AssetType.STOCK });
    });

    it('should skip tickers and ISINs stored as morningstarId', () => {
      expect(
        planIdentityRepair({
          id: '1',
          morningstarId: 'IS3S',
          type: AssetType.ETF,
          url: null,
          name: 'iShares',
        }),
      ).toEqual({ action: 'skip', reason: 'INVALID_ID' });
      expect(
        planIdentityRepair({
          id: '2',
          morningstarId: 'LU0491217419',
          type: AssetType.FUND,
          url: null,
          name: 'Robeco',
        }),
      ).toEqual({ action: 'skip', reason: 'INVALID_ID' });
    });

    it('should save an F ID already in the URL without a lookup', () => {
      expect(
        planIdentityRepair({
          id: '1',
          morningstarId: '0P00016YQ5',
          type: AssetType.FUND,
          url: 'https://global.morningstar.com/es/inversiones/fondos/F00000WI0D/cotizacion',
          name: 'Azvalor',
        }),
      ).toEqual({ action: 'save_share_class', shareClassId: 'F00000WI0D' });
    });

    it('should look up a valid 0P fund', () => {
      expect(
        planIdentityRepair({
          id: '1',
          morningstarId: '0P0001NF8R',
          type: AssetType.ETF,
          url: 'https://global.morningstar.com/es/inversiones/etfs/0P0001NF8R/cotizacion',
          name: 'VanEck',
        }),
      ).toEqual({ action: 'lookup', morningstarId: '0P0001NF8R' });
    });

    it('should copy an F morningstarId into shareClassId without a lookup', () => {
      expect(
        planIdentityRepair({
          id: '1',
          morningstarId: 'F00001SELW',
          type: AssetType.FUND,
          url: null,
          name: 'iShares Emerging Markets',
        }),
      ).toEqual({ action: 'save_share_class', shareClassId: 'F00001SELW' });
    });

    it('should skip when shareClassId already matches the local F ID', () => {
      expect(
        planIdentityRepair({
          id: '1',
          morningstarId: 'F00001SELW',
          shareClassId: 'F00001SELW',
          type: AssetType.FUND,
          url: null,
          name: 'iShares Emerging Markets',
        }),
      ).toEqual({ action: 'skip', reason: 'NO_LOOKUP_NEEDED' });
    });

    it('should skip stocks after they are already typed as STOCK', () => {
      expect(
        planIdentityRepair({
          id: '1',
          morningstarId: '0P00005U6B',
          type: AssetType.STOCK,
          url: 'https://global.morningstar.com/es/inversiones/acciones/0P00005U6B/cotizacion',
          name: 'Mastercard',
        }),
      ).toEqual({ action: 'skip', reason: 'STOCK' });
    });
  });
});
