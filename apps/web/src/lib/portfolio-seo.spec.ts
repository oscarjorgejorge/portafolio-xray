import { describe, expect, it } from 'vitest';
import {
  buildPortfolioPageCopy,
  formatHoldingIdentifier,
  isIndexablePublicPortfolio,
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

const PORTFOLIO_ID = 'd9d1c78b-ed22-47ff-9774-7f17ece3d2a0';

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
    const copy = buildPortfolioPageCopy('es', 'Toni', holdings, PORTFOLIO_ID);

    expect(copy.title).toBe('Cartera Toni: Apple y Nike — X-Ray gratis (d9d1c78b)');
    expect(copy.headline).toBe('Toni');
    expect(copy.description).toBe(
      'Toni reúne 2 activos. Apple es la posición principal (60% del peso). La clase predominante es acciones (100% del peso). La cartera está concentrada. (d9d1c78b)',
    );
    expect(copy.title).not.toBe('Explorar carteras públicas');
  });

  it('uses the top holding names when the portfolio has no name', () => {
    const copy = buildPortfolioPageCopy('es', '   ', holdings, PORTFOLIO_ID);

    expect(copy.headline).toBe('Cartera con Apple, Nike — X-Ray');
    expect(copy.title).toBe('Cartera con Apple, Nike — X-Ray (d9d1c78b)');
    expect(copy.description.startsWith('Esta cartera reúne 2 activos.')).toBe(true);
    expect(copy.description).toContain('Apple es la posición principal (60% del peso).');
  });

  it('keeps the second holding out of the title when the pair would pass 65 characters', () => {
    const longBook = [
      holding({
        morningstarId: 'F1',
        weight: 80,
        name: 'JPM Global Income A acc EUR',
        type: 'FUND',
      }),
      holding({
        morningstarId: 'F2',
        weight: 20,
        name: 'Azvalor Internacional FI',
        type: 'FUND',
      }),
    ];
    const copy = buildPortfolioPageCopy('es', 'Mi cartera', longBook, PORTFOLIO_ID);

    expect(copy.title).toBe(
      'Cartera Mi cartera: JPM Global Income A acc EUR y 1 más — X-Ray gratis (d9d1c78b)',
    );
    expect(copy.headline).toBe('Mi cartera');
    expect(copy.description).toContain(
      'JPM Global Income A acc EUR es la posición principal (80% del peso).',
    );
  });

  it('separates two portfolios that share a name and the same lead holding', () => {
    const otherId = 'a221a0fd-8dea-49fa-b8c0-efc8e225a0ee';
    const first = buildPortfolioPageCopy('es', 'Mi cartera', holdings, PORTFOLIO_ID);
    const second = buildPortfolioPageCopy('es', 'Mi cartera', holdings, otherId);

    expect(first.headline).toBe(second.headline);
    expect(first.title).not.toBe(second.title);
    expect(first.description).not.toBe(second.description);
    expect(second.title.endsWith('(a221a0fd)')).toBe(true);
  });

  it('marks a broad book as diversified and names the largest holdings', () => {
    const broad = Array.from({ length: 8 }, (_, index) =>
      holding({
        morningstarId: `F${index}`,
        weight: 12.5,
        name: `Fund ${index}`,
        type: 'FUND',
      }),
    );
    const copy = buildPortfolioPageCopy('en', 'Wide', broad, PORTFOLIO_ID);

    expect(copy.description).toContain('Fund 0 is the largest holding (13% of weight).');
    expect(copy.description).toContain('diversified');
    expect(copy.description).toContain('funds');
    expect(copy.title).toBe(
      'Portfolio Wide: Fund 0 and Fund 1 and 6 more — free X-Ray (d9d1c78b)',
    );
    expect(copy.headline).toBe('Wide');
  });
});

describe('isIndexablePublicPortfolio', () => {
  it('requires a public id and a fully allocated book', () => {
    expect(
      isIndexablePublicPortfolio({
        id: 'abc',
        isPublic: true,
        assets: [{ weight: 60 }, { weight: 40 }],
      }),
    ).toBe(true);
    expect(
      isIndexablePublicPortfolio({
        id: 'abc',
        isPublic: false,
        assets: [{ weight: 100 }],
      }),
    ).toBe(false);
    expect(
      isIndexablePublicPortfolio({
        id: 'abc',
        isPublic: true,
        assets: [{ weight: 40 }],
      }),
    ).toBe(false);
    expect(
      isIndexablePublicPortfolio({
        id: '',
        isPublic: true,
        assets: [{ weight: 100 }],
      }),
    ).toBe(false);
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
