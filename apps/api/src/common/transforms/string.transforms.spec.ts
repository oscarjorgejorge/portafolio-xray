import { trimResolveInput, trimUppercase } from './string.transforms';

describe('string transforms', () => {
  it('uppercases ISIN and Morningstar IDs', () => {
    expect(trimResolveInput({ value: '  ie00byx5nx33  ' } as never)).toBe(
      'IE00BYX5NX33',
    );
    expect(trimUppercase({ value: '  0p0001cldk  ' } as never)).toBe(
      '0P0001CLDK',
    );
  });

  it('keeps pasted Morningstar URLs in original case', () => {
    const url =
      'https://global.morningstar.com/en-eu/investments/funds/0P0001CLDK/quote';
    expect(trimResolveInput({ value: `  ${url}  ` } as never)).toBe(url);
  });
});
