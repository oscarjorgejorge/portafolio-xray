import { describe, expect, it } from 'vitest';
import {
  countInstantXrayUnsupportedHoldings,
  isInstantXrayUnsupportedProduct,
  unmappedInstantXrayFallbackCount,
} from './instant-xray-unsupported';

describe('isInstantXrayUnsupportedProduct', () => {
  it('flags Spanish FIL, pension plans and EPSV names from this portfolio', () => {
    expect(isInstantXrayUnsupportedProduct('Criptomonedas, FIL A')).toBe(true);
    expect(
      isInstantXrayUnsupportedProduct('MyInvestor Cartera Permanente PP'),
    ).toBe(true);
    expect(
      isInstantXrayUnsupportedProduct('Myinvestor Indexado S&P 500 PP'),
    ).toBe(true);
    expect(
      isInstantXrayUnsupportedProduct(
        'Indexa Más Rentabilidad Acciones EPSV',
      ),
    ).toBe(true);
  });

  it('flags descriptive pension and FIL wording', () => {
    expect(isInstantXrayUnsupportedProduct('Plan de pensiones global')).toBe(
      true,
    );
    expect(
      isInstantXrayUnsupportedProduct('Fondo de inversión libre cripto'),
    ).toBe(true);
    expect(isInstantXrayUnsupportedProduct('Indexa Acciones PPSI')).toBe(true);
  });

  it('does not flag UCITS funds, ETFs or stocks', () => {
    expect(
      isInstantXrayUnsupportedProduct('Gestión Boutique VI Argos FI'),
    ).toBe(false);
    expect(
      isInstantXrayUnsupportedProduct(
        'iShares MSCI EM UCITS ETF USD (Acc)',
      ),
    ).toBe(false);
    expect(isInstantXrayUnsupportedProduct('Meta Platforms Inc Class A')).toBe(
      false,
    );
    expect(isInstantXrayUnsupportedProduct('Fidelity Funds Iberia A-Acc-EUR')).toBe(
      false,
    );
  });

  it('ignores empty names', () => {
    expect(isInstantXrayUnsupportedProduct(null)).toBe(false);
    expect(isInstantXrayUnsupportedProduct('')).toBe(false);
    expect(isInstantXrayUnsupportedProduct('   ')).toBe(false);
  });
});

describe('countInstantXrayUnsupportedHoldings', () => {
  it('counts resolved names and falls back to the identifier', () => {
    expect(
      countInstantXrayUnsupportedHoldings([
        { asset: { name: 'Criptomonedas, FIL A' } },
        { asset: { name: 'Gestión Boutique VI Argos FI' } },
        { identifier: 'MyInvestor Indexado S&P 500 PP' },
      ]),
    ).toBe(2);
  });
});

describe('unmappedInstantXrayFallbackCount', () => {
  it('subtracts unsupported holdings from the generate fallback count', () => {
    expect(unmappedInstantXrayFallbackCount(4, 4)).toBe(0);
    expect(unmappedInstantXrayFallbackCount(5, 4)).toBe(1);
    expect(unmappedInstantXrayFallbackCount(1, 4)).toBe(0);
  });
});
