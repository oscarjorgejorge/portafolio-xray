import { describe, it, expect } from 'vitest';
import {
  absoluteUrl,
  brandedAbsoluteTitle,
  brandedTitle,
  hasLocalePrefix,
  isCanonicalHost,
  localeLanguageAlternates,
  localeMetadata,
  localizedPath,
  prefixWithDefaultLocale,
  toValidDate,
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

  it('detects locale prefixes and maps unprefixed paths to /es', () => {
    expect(hasLocalePrefix('/')).toBe(false);
    expect(hasLocalePrefix('/explore/abc')).toBe(false);
    expect(hasLocalePrefix('/es')).toBe(true);
    expect(hasLocalePrefix('/en/explore/abc')).toBe(true);
    expect(prefixWithDefaultLocale('/')).toBe('/es');
    expect(prefixWithDefaultLocale('/explore/abc')).toBe('/es/explore/abc');
  });

  it('treats only the canonical host as indexable', () => {
    expect(isCanonicalHost(undefined)).toBe(true);
    expect(isCanonicalHost('www.xrayportfolio.com')).toBe(true);
    expect(isCanonicalHost('WWW.xrayportfolio.com')).toBe(true);
    expect(isCanonicalHost('xrayportfolio.com')).toBe(false);
    expect(isCanonicalHost('portafolio-xray.vercel.app')).toBe(false);
    expect(isCanonicalHost('localhost:3000')).toBe(false);
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

  it('appends the brand suffix without doubling it', () => {
    expect(brandedTitle('Samu')).toBe('Samu | Portfolio X-Ray');
    expect(brandedTitle('Samu | Portfolio X-Ray')).toBe(
      'Samu | Portfolio X-Ray',
    );
    expect(brandedTitle('   ')).toBe('Portfolio X-Ray');
    expect(brandedAbsoluteTitle('Samu')).toEqual({
      absolute: 'Samu | Portfolio X-Ray',
    });
  });

  it('rejects invalid dates for sitemap lastmod', () => {
    const fallback = new Date('2026-01-01T00:00:00.000Z');

    expect(toValidDate('not-a-date', fallback)).toBe(fallback);
    expect(toValidDate('', fallback)).toBe(fallback);
    expect(toValidDate(null, fallback)).toBe(fallback);
    expect(toValidDate('2026-09-17T10:00:00.000Z', fallback).toISOString()).toBe(
      '2026-09-17T10:00:00.000Z',
    );
  });
});
