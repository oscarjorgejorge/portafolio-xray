'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { useAuthModal } from '@/lib/auth/AuthModalContext';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';

export function NavBar() {
  const tNav = useTranslations('navigation');
  const tLogin = useTranslations('auth.login');
  const tRegister = useTranslations('auth.register');
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
  const isVerifyEmailPage = pathname?.includes('/verify-email');
  // Hide user name link if email is not verified or on verification pages
  const shouldShowUserInfo = isAuthenticated && user?.emailVerified && !isVerifyEmailPage;

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Logo + desktop navigation */}
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              Portfolio X-Ray
            </Link>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link
                href="/"
                className={`px-1 border-b-2 ${
                  isActive('/') ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tNav('home')}
              </Link>
              <Link
                href="/explore"
                className={`px-1 border-b-2 ${
                  isActive('/explore')
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tNav('explorePortfolios')}
              </Link>
              <Link
                href="/contact"
                className={`px-1 border-b-2 ${
                  isActive('/contact')
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tNav('contact')}
              </Link>
            </div>
          </div>

          {/* Right side - Language selector and Auth buttons */}
          <div className="flex items-center gap-4">
            {/* Desktop: language + auth */}
            <div className="hidden md:flex items-center gap-4">
              <LanguageSwitcher />

              {!isAuthPage && !isVerifyEmailPage &&
                (shouldShowUserInfo ? (
                  <Link
                    href="/profile"
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    {user?.name || user?.userName || user?.email}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openAuthModal({ tab: 'signin' })}>
                      {tLogin('signIn')}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => openAuthModal({ tab: 'register' })}>
                      {tRegister('createAccount')}
                    </Button>
                  </div>
                ))}
            </div>

            {/* Mobile: language to the left of hamburger */}
            <div className="flex items-center gap-2 md:hidden">
              <LanguageSwitcher />
              <button
                type="button"
                aria-label="Toggle navigation menu"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <span className="sr-only">Open main menu</span>
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  {isMobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 pt-2 pb-4 space-y-2">
            <div className="flex flex-col space-y-2 text-sm font-medium">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className={`py-1 ${
                  isActive('/') ? 'text-blue-600' : 'text-gray-700'
                }`}
              >
                {tNav('home')}
              </Link>
              <Link
                href="/explore"
                onClick={closeMobileMenu}
                className={`py-1 ${
                  isActive('/explore') ? 'text-blue-600' : 'text-gray-700'
                }`}
              >
                {tNav('explorePortfolios')}
              </Link>
              <Link
                href="/contact"
                onClick={closeMobileMenu}
                className={`py-1 ${
                  isActive('/contact') ? 'text-blue-600' : 'text-gray-700'
                }`}
              >
                {tNav('contact')}
              </Link>
              {isAuthenticated && user?.emailVerified && (
                <>
                  <Link
                    href="/portfolios"
                    onClick={closeMobileMenu}
                    className={`py-1 ${
                      isActive('/portfolios') ? 'text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {tNav('myPortfolios')}
                  </Link>
                  <Link
                    href="/favorites"
                    onClick={closeMobileMenu}
                    className={`py-1 ${
                      isActive('/favorites') ? 'text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {tNav('myFavorites')}
                  </Link>
                </>
              )}
            </div>

            {!isAuthPage && !isVerifyEmailPage && (
              <div className="pt-2 border-t border-gray-200 flex flex-col gap-2">
                {shouldShowUserInfo ? (
                  <Link
                    href="/profile"
                    onClick={closeMobileMenu}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    {user?.name || user?.userName || user?.email}
                  </Link>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center"
                      onClick={() => { openAuthModal({ tab: 'signin' }); closeMobileMenu(); }}
                    >
                      {tLogin('signIn')}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full justify-center"
                      onClick={() => { openAuthModal({ tab: 'register' }); closeMobileMenu(); }}
                    >
                      {tRegister('createAccount')}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
