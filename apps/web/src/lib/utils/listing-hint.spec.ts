import { describe, expect, it } from 'vitest';
import { listingKind, listingPlace } from './listing-hint';

describe('listing-hint', () => {
  it('tells the BBVA lines apart', () => {
    expect(listingKind('Banco Bilbao Vizcaya Argentaria SA')).toBe('ordinary');
    expect(listingKind('Banco Bilbao Vizcaya Argentaria SA ADR')).toBe('adr');
    expect(listingKind('Banco Bilbao Vizcaya Argentaria SA CDR (CAD Hedged)')).toBe(
      'cdr',
    );
    expect(listingKind('Banco Bilbao Vizcaya Argentaria SA Cedear')).toBe('cedear');
  });

  it('prefers the exchange name over the ISIN country', () => {
    expect(listingPlace('ES0113211835', 'XMAD', 'es')).toBe('Madrid');
    expect(listingPlace('US05946K1016', 'XNYS', 'es')).toBe('NYSE');
    expect(listingPlace('ES0113211835', undefined, 'es')).toBe('España');
    expect(listingPlace('US05946K1016', undefined, 'en')).toBe('United States');
  });
});