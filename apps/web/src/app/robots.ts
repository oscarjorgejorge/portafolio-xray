import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { getCanonicalHost, getSiteUrl, localizedPath } from '@/lib/seo';

const PRIVATE_PATHS = [
  '/portfolios',
  '/favorites',
  '/profile',
  '/xray',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-email-pending',
  '/auth/callback',
];

/**
 * Static robots.txt for the canonical host. Other hosts (previews, the
 * platform's own domain, localhost) are rewritten to /robots-noindex.txt
 * in next.config.js, so this never has to read request headers.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const disallow = [
    '/auth/callback',
    ...routing.locales.flatMap((locale) =>
      PRIVATE_PATHS.map((path) => localizedPath(locale, path)),
    ),
  ];

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow,
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: getCanonicalHost(),
  };
}
