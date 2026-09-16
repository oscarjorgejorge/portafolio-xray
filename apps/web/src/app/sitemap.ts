import type { MetadataRoute } from 'next';
import { getPublicPortfolios } from '@/lib/api/portfolios';
import { routing } from '@/i18n/routing';
import { absoluteUrl, localeLanguageAlternates } from '@/lib/seo';

export const revalidate = 3600;

const STATIC_PATHS = ['/', '/explore', '/contact', '/terms', '/privacy'];

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticEntries = routing.locales.flatMap((locale) =>
    STATIC_PATHS.map((pathname) =>
      sitemapEntry(locale, pathname, lastModified),
    ),
  );

  try {
    const portfolios = await getPublicPortfolios();
    const portfolioEntries = portfolios.flatMap((portfolio) =>
      routing.locales.map((locale) =>
        sitemapEntry(
          locale,
          `/explore/${portfolio.id}`,
          portfolio.updatedAt ? new Date(portfolio.updatedAt) : lastModified,
        ),
      ),
    );

    return [...staticEntries, ...portfolioEntries];
  } catch {
    return staticEntries;
  }
}
