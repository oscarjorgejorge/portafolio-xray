import { AssetType } from '@prisma/client';
import {
  buildRemapCandidates,
  passesLocalVerification,
  type RepairAsset,
} from './repair-morningstar-ids.logic';

const fund = (
  overrides: Partial<RepairAsset> & Pick<RepairAsset, 'morningstarId' | 'name'>,
): RepairAsset => ({
  id: overrides.id ?? overrides.morningstarId,
  isin: overrides.isin ?? null,
  type: overrides.type ?? AssetType.FUND,
  url: overrides.url ?? '',
  morningstarId: overrides.morningstarId,
  name: overrides.name,
});

describe('buildRemapCandidates', () => {
  it('should remap 0P to F when they share an ISIN', () => {
    const { candidates, leftovers } = buildRemapCandidates([
      fund({
        morningstarId: '0P00016YQ5',
        isin: 'ES0112611001',
        name: 'AZ Valor INternacional',
      }),
      fund({
        morningstarId: 'F00000WI0D',
        isin: 'ES0112611001',
        name: 'Azvalor Internacional FI',
      }),
    ]);

    expect(candidates).toEqual([
      expect.objectContaining({
        oldId: '0P00016YQ5',
        canonicalId: 'F00000WI0D',
        source: 'isin_group',
      }),
    ]);
    expect(leftovers).toHaveLength(0);
  });

  it('should remap 0P to F extracted from the URL', () => {
    const { candidates } = buildRemapCandidates([
      fund({
        morningstarId: '0P00016YQ5',
        name: 'Azvalor Internacional FI',
        url: 'https://global.morningstar.com/es/inversiones/fondos/F00000WI0D/cotizacion',
      }),
    ]);

    expect(candidates[0]).toMatchObject({
      oldId: '0P00016YQ5',
      canonicalId: 'F00000WI0D',
      source: 'url',
    });
  });

  it('should leave 0P funds without an F candidate as leftovers', () => {
    const { candidates, leftovers } = buildRemapCandidates([
      fund({
        morningstarId: '0P0001AAAA',
        name: 'Unknown Fund',
        url: 'https://global.morningstar.com/es/inversiones/fondos/0P0001AAAA/cotizacion',
      }),
    ]);

    expect(candidates).toHaveLength(0);
    expect(leftovers).toEqual([
      expect.objectContaining({
        morningstarId: '0P0001AAAA',
        reason: 'no_f_candidate',
      }),
    ]);
  });

  it('should not remap stocks', () => {
    const { candidates, leftovers } = buildRemapCandidates([
      fund({
        morningstarId: '0P0000AAPL',
        name: 'Apple',
        type: AssetType.STOCK,
      }),
    ]);

    expect(candidates).toHaveLength(0);
    expect(leftovers).toHaveLength(0);
  });
});

describe('passesLocalVerification', () => {
  it('should reject ISIN mismatches', () => {
    const result = passesLocalVerification(
      {
        oldId: '0P00016YQ5',
        canonicalId: 'F00000WI0D',
        oldName: 'Azvalor Internacional FI',
        canonicalName: 'Azvalor Internacional FI',
        source: 'url',
      },
      fund({
        morningstarId: '0P00016YQ5',
        isin: 'ES0112611001',
        name: 'Azvalor Internacional FI',
      }),
      fund({
        morningstarId: 'F00000WI0D',
        isin: 'LU1988110927',
        name: 'Azvalor Internacional FI',
      }),
    );

    expect(result).toEqual({ ok: false, reason: 'isin_mismatch' });
  });
});
