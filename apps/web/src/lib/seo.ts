import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import { env } from '@/lib/env';

export const CANONICAL_HOST = 'www.xrayportfolio.com';
export const BRAND_NAME = 'Portfolio X-Ray';
const DEFAULT_SITE_URL = `https://${CANONICAL_HOST}`;

/**
 * Page title with a consistent brand suffix. Does not double the suffix
 * when the input already ends with it.
 */
export function brandedTitle(pageTitle: string): string {
  const trimmed = pageTitle.trim();
  if (!trimmed) {
    return BRAND_NAME;
  }
  if (trimmed === BRAND_NAME || trimmed.endsWith(` | ${BRAND_NAME}`)) {
    return trimmed;
  }
  return `${trimmed} | ${BRAND_NAME}`;
}

export function brandedAbsoluteTitle(pageTitle: string): { absolute: string } {
  return { absolute: brandedTitle(pageTitle) };
}

/**
 * Coerce lastmod values so sitemap XML serialization never receives Invalid Date.
 */
export function toValidDate(
  value: string | Date | null | undefined,
  fallback: Date,
): Date {
  if (value == null || value === '') {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

/**
 * Canonical origin with no trailing slash.
 */
export function getSiteUrl(): string {
  const raw = env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}

export function getCanonicalHost(): string {
  try {
    return new URL(getSiteUrl()).host;
  } catch {
    return CANONICAL_HOST;
  }
}

/**
 * True when the request Host is the indexable origin.
 * Missing host (build/prerender) is treated as canonical so sitemap/robots
 * still generate for production.
 */
export function isCanonicalHost(host: string | null | undefined): boolean {
  if (!host) {
    return true;
  }

  return host.split(':')[0].toLowerCase() === getCanonicalHost().toLowerCase();
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
