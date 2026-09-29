import { describe, expect, it } from 'vitest';
import {
  buildPortfolioPageCopy,
  formatHoldingIdentifier,
  type PortfolioHoldingView,
} from './portfolio-seo';

function holding(
  partial: Partial<PortfolioHoldingView> & Pick<PortfolioHoldingView, 'morningstarId' | 'weight'>,
): PortfolioHoldingView {
  return {
    name: partial.morningstarId,
    ticker: null,
    isin: null,
    type: null,
    ...partial,
  };
}

describe('buildPortfolioPageCopy', () => {
  const holdings = [
    holding({
      morningstarId: 'F1',
      weight: 60,
      name: 'Apple',
      ticker: 'AAPL',
      isin: 'US0378331005',
      type: 'STOCK',
    }),
    holding({
      morningstarId: 'F2',
      weight: 40,
      name: 'Nike',
      ticker: 'NKE',
      type: 'STOCK',
    }),
  ];

  it('builds a unique title and description from the portfolio name and holdings', () => {
    const copy = buildPortfolioPageCopy('es', 'Toni', holdings);

    expect(copy.title).toBe('Cartera Toni: 2 activos — X-Ray gratis');
    expect(copy.headline).toBe('Toni');
    expect(copy.description).toContain('Toni reúne 2 activos.');
    expect(copy.description).toContain('acciones (100% del peso)');
    expect(copy.description).toContain('concentrada');
    expect(copy.title).not.toBe('Explorar carteras públicas');
  });

  it('uses the top holding names when the portfolio has no name', () => {
    const copy = buildPortfolioPageCopy('es', '   ', holdings);

    expect(copy.title).toBe('Cartera con Apple, Nike — X-Ray');
    expect(copy.headline).toBe(copy.title);
    expect(copy.description.startsWith('Esta cartera reúne 2 activos.')).toBe(true);
  });

  it('marks a broad book as diversified', () => {
    const broad = Array.from({ length: 8 }, (_, index) =>
      holding({
        morningstarId: `F${index}`,
        weight: 12.5,
        name: `Fund ${index}`,
        type: 'FUND',
      }),
    );
    const copy = buildPortfolioPageCopy('en', 'Wide', broad);

    expect(copy.description).toContain('diversified');
    expect(copy.description).toContain('funds');
    expect(copy.title).toBe('Portfolio Wide: 8 assets — free X-Ray');
  });
});

describe('formatHoldingIdentifier', () => {
  it('prefers ticker and ISIN together, then each one alone', () => {
    expect(
      formatHoldingIdentifier({
        morningstarId: 'F1',
        ticker: 'AAPL',
        isin: 'US0378331005',
      }),
    ).toBe('AAPL · US0378331005');
    expect(
      formatHoldingIdentifier({
        morningstarId: 'F1',
        ticker: null,
        isin: 'US0378331005',
      }),
    ).toBe('US0378331005');
    expect(
      formatHoldingIdentifier({
        morningstarId: 'F1',
        ticker: null,
        isin: null,
      }),
    ).toBe('F1');
  });
});
