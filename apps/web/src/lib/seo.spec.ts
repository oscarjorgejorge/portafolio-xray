import { describe, it, expect } from 'vitest';
import {
  absoluteUrl,
  localeLanguageAlternates,
  localeMetadata,
  localizedPath,
} from './seo';

describe('seo helpers', () => {
  it('builds locale-prefixed paths without a trailing slash', () => {
    expect(localizedPath('es', '/')).toBe('/es');
    expect(localizedPath('en', '/explore')).toBe('/en/explore');
    expect(localizedPath('es', '/explore/abc/')).toBe('/es/explore/abc');
  });

  it('builds absolute canonical URLs', () => {
    expect(absoluteUrl('es', '/')).toBe('https://www.xrayportfolio.com/es');
    expect(absoluteUrl('en', '/contact')).toBe(
      'https://www.xrayportfolio.com/en/contact',
    );
  });

  it('emits reciprocal hreflang including self and x-default', () => {
    const languages = localeLanguageAlternates('/contact');

    expect(languages.es).toBe('https://www.xrayportfolio.com/es/contact');
    expect(languages.en).toBe('https://www.xrayportfolio.com/en/contact');
    expect(languages['x-default']).toBe(
      'https://www.xrayportfolio.com/es/contact',
    );
  });

  it('sets canonical to the current locale URL', () => {
    const metadata = localeMetadata('en', '/explore');

    expect(metadata.alternates?.canonical).toBe(
      'https://www.xrayportfolio.com/en/explore',
    );
    expect(metadata.alternates?.languages).toEqual(
      localeLanguageAlternates('/explore'),
    );
  });
});
