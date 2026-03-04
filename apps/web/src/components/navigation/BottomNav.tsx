'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';

/**
 * Mobile-only sticky bar at the bottom with icon link to My portfolios (and Home).
 */
export function BottomNav() {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();
  const showPortfolios = isAuthenticated && user?.emailVerified;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-pb"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium ${
            pathname === '/' ? 'text-blue-600' : 'text-gray-500'
          }`}
          aria-label={t('home')}
        >
          <HomeIcon className="w-6 h-6 mb-0.5" />
          {t('home')}
        </Link>
        {showPortfolios && (
          <Link
            href="/portfolios"
            className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium ${
              pathname === '/portfolios' ? 'text-blue-600' : 'text-gray-500'
            }`}
            aria-label={t('myPortfolios')}
          >
            <PortfoliosIcon className="w-6 h-6 mb-0.5" />
            {t('myPortfolios')}
          </Link>
        )}
      </div>
    </nav>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11v2a1 1 0 01-1 1h2m-1-1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2" />
    </svg>
  );
}

function PortfoliosIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
