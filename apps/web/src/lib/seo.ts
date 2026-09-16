import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import { env } from '@/lib/env';

const DEFAULT_SITE_URL = 'https://www.xrayportfolio.com';

/**
 * Canonical origin with no trailing slash.
 */
export function getSiteUrl(): string {
  const raw = env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}

/**
 * Locale-prefixed path without a trailing slash.
 * Home is `/es` or `/en` (localePrefix: always).
 */
export function localizedPath(locale: string, pathname: string): string {
  let normalized = '';

  if (pathname && pathname !== '/') {
    const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
    normalized = withSlash.replace(/\/+$/, '');
  }

  return `/${locale}${normalized}`;
}

export function absoluteUrl(locale: string, pathname: string): string {
  return `${getSiteUrl()}${localizedPath(locale, pathname)}`;
}

/**
 * Reciprocal hreflang map for a locale-free path, including self-references
 * and x-default (Spanish).
 */
export function localeLanguageAlternates(
  pathname: string,
): Record<string, string> {
  const languages: Record<string, string> = {};

  for (const locale of routing.locales) {
    languages[locale] = absoluteUrl(locale, pathname);
  }

  languages['x-default'] = absoluteUrl(routing.defaultLocale, pathname);
  return languages;
}

/**
 * Canonical + hreflang for one public page. Call this from every public
 * generateMetadata so children do not inherit homepage alternates.
 */
export function localeMetadata(
  locale: string,
  pathname: string,
): Pick<Metadata, 'metadataBase' | 'alternates'> {
  const canonical = absoluteUrl(locale, pathname);

  return {
    metadataBase: new URL(getSiteUrl()),
    alternates: {
      canonical,
      languages: localeLanguageAlternates(pathname),
    },
  };
}

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};
