import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const handleI18n = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}`;
    return NextResponse.redirect(url, 308);
  }

  return handleI18n(request);
}

export const config = {
  matcher: ['/', '/(es|en)/:path*'],
};
