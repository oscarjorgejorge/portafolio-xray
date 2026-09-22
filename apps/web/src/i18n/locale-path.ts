import { routing } from './routing';

/**
 * True when the path already starts with /es or /en.
 */
export function hasLocalePrefix(pathname: string): boolean {
  return routing.locales.some(
    (locale) =>
      pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
}

/**
 * Prefix an unprefixed path with the default locale (/es).
 * `/` → `/es`, `/explore/id` → `/es/explore/id`.
 */
export function prefixWithDefaultLocale(pathname: string): string {
  if (pathname === '/') {
    return `/${routing.defaultLocale}`;
  }

  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `/${routing.defaultLocale}${withSlash}`;
}
