import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getPublicPortfolios } from '@/lib/api/portfolios';
import { API } from '@/lib/constants';
import { routing } from '@/i18n/routing';
import {
  absoluteUrl,
  isCanonicalHost,
  localeLanguageAlternates,
  toValidDate,
} from '@/lib/seo';

export const revalidate = 3600;
export const maxDuration = 30;

const STATIC_PATHS = [
  '/',
  '/explore',
  '/contact',
  '/terms',
  '/privacy',
  '/que-es-un-xray-de-cartera',
  '/como-funciona',
];

function sitemapEntry(
  locale: (typeof routing.locales)[number],
  pathname: string,
  lastModified: Date,
): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(locale, pathname),
    lastModified,
    alternates: {
      languages: localeLanguageAlternates(pathname),
    },
  };
}

async function getRequestHost(): Promise<string | null> {
  try {
    return (await headers()).get('host');
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const host = await getRequestHost();
    if (!isCanonicalHost(host)) {
      return [];
    }

    const lastModified = new Date();

    const staticEntries = routing.locales.flatMap((locale) =>
      STATIC_PATHS.map((pathname) =>
        sitemapEntry(locale, pathname, lastModified),
      ),
    );

    try {
      const portfolios = await getPublicPortfolios(
        undefined,
        API.SITEMAP_TIMEOUT_MS,
      );
      const portfolioEntries = portfolios.flatMap((portfolio) => {
        if (!portfolio?.id) {
          return [];
        }

        const updatedAt = toValidDate(portfolio.updatedAt, lastModified);

        return routing.locales.map((locale) =>
          sitemapEntry(locale, `/explore/${portfolio.id}`, updatedAt),
        );
      });

      return [...staticEntries, ...portfolioEntries];
    } catch {
      return staticEntries;
    }
  } catch {
    return [];
  }
}
