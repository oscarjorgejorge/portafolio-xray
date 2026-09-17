import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ApiError } from '@/lib/api/client';
import { getPublicPortfolio } from '@/lib/api/portfolios';
import { brandedAbsoluteTitle, brandedTitle, localeMetadata, absoluteUrl } from '@/lib/seo';
import { PublicPortfolioDetailClient } from './PublicPortfolioDetailClient';

const getCachedPublicPortfolio = cache(getPublicPortfolio);

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
    const portfolio = await getCachedPublicPortfolio(id);
    const name = portfolio.name?.trim() || t('exploreTitle');
    const description =
      portfolio.description?.trim() ||
      t('publicPortfolioSeoDescription', {
        name,
        userName: portfolio.userName,
      });

    return {
      ...seo,
      title: brandedAbsoluteTitle(name),
      description,
      openGraph: {
        title: brandedTitle(name),
        description,
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
  const { id } = await params;

  if (!id) {
    notFound();
  }

  try {
    const portfolio = await getCachedPublicPortfolio(id);
    return <PublicPortfolioDetailClient initialPortfolio={portfolio} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
