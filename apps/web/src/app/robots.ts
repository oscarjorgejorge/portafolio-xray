import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';
import { getCanonicalHost, getSiteUrl, isCanonicalHost, localizedPath } from '@/lib/seo';

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

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host');

  if (!isCanonicalHost(host)) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

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
