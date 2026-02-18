'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Button } from '@/components/ui/Button';

export function NavBar() {
  const tLogin = useTranslations('auth.login');
  const tRegister = useTranslations('auth.register');
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isVerifyEmailPage = pathname?.includes('/verify-email');
  // Hide user name link if email is not verified or on verification pages
  const shouldShowUserInfo = isAuthenticated && user?.emailVerified && !isVerifyEmailPage;

  return (
    <nav className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left side - Logo/Title */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-gray-900">
              Portfolio X-Ray
            </Link>
          </div>

          {/* Right side - Language selector and Auth buttons */}
          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Auth buttons */}
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
                    <Link href="/login">
                      <Button variant="ghost" size="sm">
                        {tLogin('signIn')}
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button variant="primary" size="sm">
                        {tRegister('createAccount')}
                      </Button>
                    </Link>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
