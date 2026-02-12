import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for:
  // - API routes (/api/...)
  // - Static files (/_next/..., /images/..., etc.)
  // - Files with extensions (.ico, .svg, .png, etc.)
  matcher: ['/', '/(es|en)/:path*']
};
