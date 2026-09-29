import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getPublicPortfolios } from '@/lib/api/portfolios';

const RECENT_LIMIT = 6;

/**
 * Extra crawl path from the home page to individual public portfolios.
 * The explore index already links every portfolio; this adds a second entry.
 */
export async function RecentPublicPortfolios({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'portfolios' });

  let portfolios: Awaited<ReturnType<typeof getPublicPortfolios>> = [];
  try {
    portfolios = await getPublicPortfolios({ sortBy: 'recent' });
  } catch {
    return null;
  }

  const recent = portfolios.slice(0, RECENT_LIMIT);
  if (recent.length === 0) {
    return null;
  }

  return (
    <section className="bg-slate-100 px-4 pb-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-bold text-slate-900">{t('recentPublicHeading')}</h2>
        <p className="mt-2 text-sm text-slate-600">{t('recentPublicLead')}</p>
        <ul className="mt-4 space-y-2">
          {recent.map((portfolio) => (
            <li key={portfolio.id}>
              <Link
                href={`/explore/${portfolio.id}`}
                className="font-medium text-slate-900 underline-offset-2 hover:underline"
              >
                {portfolio.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
