'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { useAuthModal } from '@/lib/auth/AuthModalContext';

/**
 * Mobile-only sticky bar at the bottom with icon link to My portfolios (and Home).
 */
export function BottomNav() {
  const tNav = useTranslations('navigation');
  const tLogin = useTranslations('auth.login');
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const showPortfolios = isAuthenticated && user?.emailVerified;
  const isLoggedIn = showPortfolios;

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
          aria-label={tNav('home')}
        >
          <HomeIcon className="w-6 h-6 mb-0.5" />
          {tNav('home')}
        </Link>
        {isLoggedIn ? (
          <>
            <Link
              href="/explore"
              className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium ${
                pathname === '/explore' ? 'text-blue-600' : 'text-gray-500'
              }`}
              aria-label={tNav('explorePortfolios')}
            >
              <ExploreIcon className="w-6 h-6 mb-0.5" />
              {tNav('explorePortfolios')}
            </Link>
            <Link
              href="/portfolios"
              className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium ${
                pathname === '/portfolios' ? 'text-blue-600' : 'text-gray-500'
              }`}
              aria-label={tNav('myPortfolios')}
            >
              <PortfoliosIcon className="w-6 h-6 mb-0.5" />
              {tNav('myPortfolios')}
            </Link>
            <Link
              href="/favorites"
              className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium ${
                pathname === '/favorites' ? 'text-blue-600' : 'text-gray-500'
              }`}
              aria-label={tNav('myFavorites')}
            >
              <HeartIcon className="w-6 h-6 mb-0.5" />
              {tNav('myFavorites')}
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/explore"
              className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium ${
                pathname === '/explore' ? 'text-blue-600' : 'text-gray-500'
              }`}
              aria-label={tNav('explorePortfolios')}
            >
              <ExploreIcon className="w-6 h-6 mb-0.5" />
              {tNav('explorePortfolios')}
            </Link>
            <button
              type="button"
              onClick={() => openAuthModal({ tab: 'signin' })}
              className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium ${
                pathname === '/login' ? 'text-blue-600' : 'text-gray-500'
              }`}
              aria-label={tLogin('signIn')}
            >
              <UserIcon className="w-6 h-6 mb-0.5" />
              {tLogin('signIn')}
            </button>
          </>
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

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

function ExploreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5.121 17.804A8 8 0 1118.88 17.804M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
