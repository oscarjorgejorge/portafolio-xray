import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  getPublicPortfolios,
  type GetPublicPortfoliosParams,
} from '@/lib/api/portfolios';
import { Link } from '@/i18n/navigation';
import { localeMetadata } from '@/lib/seo';
import { ExplorePortfoliosPage } from './ExplorePageClient';

export const dynamic = 'force-dynamic';

interface ExplorePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    name?: string;
    userName?: string;
    sortBy?: string;
  }>;
}

function parseExploreFilters(searchParams: {
  name?: string;
  userName?: string;
  sortBy?: string;
}): GetPublicPortfoliosParams {
  return {
    name: searchParams.name?.trim() || undefined,
    userName: searchParams.userName?.trim() || undefined,
    sortBy: searchParams.sortBy === 'favorites' ? 'favorites' : 'recent',
  };
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

export default async function ExplorePage({
  params,
  searchParams,
}: ExplorePageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const initialFilters = parseExploreFilters(resolvedSearchParams);
  const t = await getTranslations({ locale, namespace: 'portfolios' });

  let initialPortfolios: Awaited<ReturnType<typeof getPublicPortfolios>> = [];
  let initialLoadSucceeded = false;

  try {
    initialPortfolios = await getPublicPortfolios(initialFilters);
    initialLoadSucceeded = true;
  } catch {
    initialPortfolios = [];
  }

  return (
    <>
      {initialPortfolios.length > 0 && (
        <nav className="sr-only" aria-label={t('exploreTitle')}>
          <ul>
            {initialPortfolios.map((portfolio) => (
              <li key={portfolio.id}>
                <Link href={`/explore/${portfolio.id}`}>{portfolio.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <ExplorePortfoliosPage
        initialPortfolios={initialPortfolios}
        initialFilters={initialFilters}
        initialLoadSucceeded={initialLoadSucceeded}
      />
    </>
  );
}

