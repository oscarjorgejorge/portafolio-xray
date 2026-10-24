import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  getPublicPortfolios,
  type GetPublicPortfoliosParams,
} from '@/lib/api/portfolios';
import { Link } from '@/i18n/navigation';
import { localeMetadata } from '@/lib/seo';
import { PageLoading } from '@/components/ui/PageLoading';
import { ExplorePortfoliosPage } from './ExplorePageClient';

// Static HTML with the default listing, refreshed every 5 minutes.
// Filters (?name, ?userName, ?sortBy) are read and fetched on the client.
export const revalidate = 300;

const DEFAULT_FILTERS: GetPublicPortfoliosParams = { sortBy: 'recent' };

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

export default async function ExplorePage({ params }: ExplorePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'portfolios' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  let initialPortfolios: Awaited<ReturnType<typeof getPublicPortfolios>> = [];
  let initialLoadSucceeded = false;

  try {
    initialPortfolios = await getPublicPortfolios(DEFAULT_FILTERS);
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
      {/* The client reads filters with useSearchParams, which needs a Suspense boundary on a static page. */}
      <Suspense fallback={<PageLoading message={tCommon('loading')} />}>
        <ExplorePortfoliosPage
          initialPortfolios={initialPortfolios}
          initialFilters={DEFAULT_FILTERS}
          initialLoadSucceeded={initialLoadSucceeded}
        />
      </Suspense>
    </>
  );
}
