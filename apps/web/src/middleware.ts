import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { hasLocalePrefix, prefixWithDefaultLocale } from './i18n/locale-path';

const handleI18n = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Older responses advertised hreflang x-default without a locale prefix.
  // Keep the 308 so those URLs still land on /es instead of 404.
  if (!hasLocalePrefix(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = prefixWithDefaultLocale(pathname);
    return NextResponse.redirect(url, 308);
  }

  return handleI18n(request);
}

// Only unprefixed paths need the middleware (to 308 them to /es). /es/* and
// /en/* read the locale from the [locale] segment, so skipping them avoids
// running code on every page view and keeps those pages static.
export const config = {
  matcher: [
    '/',
    // Unprefixed public paths (not /es, /en, /_next, /favicon.ico, /sitemap.xml, …)
    '/((?!(?:es|en)(?:/|$)|_next|_vercel|.*\\..*).*)',
  ],
};
