'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Button } from '@/components/ui/Button';

export function NavBar() {
  const tLogin = useTranslations('auth.login');
  const tRegister = useTranslations('auth.register');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isVerifyEmailPage = pathname?.includes('/verify-email');
  // Hide user info and logout if email is not verified or on verification pages
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
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700">
                      {user?.name || user?.userName || user?.email}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await logout();
                        router.push('/');
                      }}
                    >
                      {tAuth('logout')}
                    </Button>
                  </div>
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
