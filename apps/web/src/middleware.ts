import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { hasLocalePrefix, prefixWithDefaultLocale } from './i18n/locale-path';

const handleI18n = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Next.js HTTP Link hreflang="x-default" strips [locale], so crawlers hit
  // /explore/:id. 308 to /es/... so those URLs are not 404s.
  if (!hasLocalePrefix(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = prefixWithDefaultLocale(pathname);
    return NextResponse.redirect(url, 308);
  }

  return handleI18n(request);
}

export const config = {
  matcher: [
    '/',
    '/(es|en)/:path*',
    // Unprefixed public paths (not /_next, /favicon.ico, /sitemap.xml, …)
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
