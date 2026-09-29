import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ApiError } from '@/lib/api/client';
import { resolvePortfolioHoldings } from '@/lib/api/portfolio-holdings';
import { getPublicPortfolio } from '@/lib/api/portfolios';
import { buildPortfolioPageCopy } from '@/lib/portfolio-seo';
import { brandedAbsoluteTitle, localeMetadata, absoluteUrl } from '@/lib/seo';
import { PublicPortfolioDetailClient } from './PublicPortfolioDetailClient';
import { PublicPortfolioIndexableContent } from './PublicPortfolioIndexableContent';

const loadPublicPortfolioPage = cache(async (id: string) => {
  const portfolio = await getPublicPortfolio(id);
  const holdings = await resolvePortfolioHoldings(portfolio.assets);
  return { portfolio, holdings };
});

interface PublicPortfolioPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({
  params,
}: PublicPortfolioPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'portfolios' });
  const seo = localeMetadata(locale, `/explore/${id}`);

  try {
    const { portfolio, holdings } = await loadPublicPortfolioPage(id);
    const copy = buildPortfolioPageCopy(locale, portfolio.name, holdings);

    return {
      ...seo,
      title: { absolute: copy.title },
      description: copy.description,
      openGraph: {
        title: copy.title,
        description: copy.description,
        locale: locale === 'es' ? 'es_ES' : 'en_US',
        url: absoluteUrl(locale, `/explore/${id}`),
      },
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        ...seo,
        title: brandedAbsoluteTitle(t('exploreTitle')),
        robots: { index: false, follow: false },
      };
    }
    throw error;
  }
}

export default async function PublicPortfolioDetailPage({
  params,
}: PublicPortfolioPageProps) {
  const { locale, id } = await params;

  if (!id) {
    notFound();
  }

  try {
    const { portfolio, holdings } = await loadPublicPortfolioPage(id);
    return (
      <PublicPortfolioDetailClient initialPortfolio={portfolio}>
        <PublicPortfolioIndexableContent
          locale={locale}
          portfolioName={portfolio.name}
          holdings={holdings}
        />
      </PublicPortfolioDetailClient>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
