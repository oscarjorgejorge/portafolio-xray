import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { localeMetadata } from '@/lib/seo';
import { ExplorePortfoliosPage } from './ExplorePageClient';

interface ExplorePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: ExplorePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'portfolios' });

  return {
    ...localeMetadata(locale, '/explore'),
    title: t('exploreTitle'),
    description: t('exploreSubtitle'),
  };
}

export default function ExplorePage() {
  return <ExplorePortfoliosPage />;
}
