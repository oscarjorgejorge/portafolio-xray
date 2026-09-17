'use client';

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Sidebar } from '@/components/navigation/Sidebar';
import { useAuth } from '@/lib/auth';
import { Link } from '@/i18n/navigation';

interface MainWithSidebarProps {
  children: ReactNode;
}

/**
 * Renders Sidebar only when the user is authenticated and verified (sidebar has content).
 * On public views (no auth), the sidebar is hidden and main content uses full width.
 * Also renders a simple footer with links to legal pages.
 */
export function MainWithSidebar({ children }: MainWithSidebarProps) {
  const { isAuthenticated, user } = useAuth();
  const tNav = useTranslations('navigation');
  const showSidebar = isAuthenticated && user?.emailVerified;
  const currentYear = new Date().getFullYear();

  return (
    <>
      {showSidebar && <Sidebar />}
      <div
        className={`${showSidebar ? 'md:pl-56' : ''} flex flex-col min-h-screen`}
      >
        <main className="flex-1 pb-16 md:pb-0">
          {children}
        </main>
        <footer className="border-t border-gray-200 bg-white px-4 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-500">
            <span>
              © {currentYear} Portfolio X-Ray. Not investment or medical advice.
            </span>
            <div className="flex flex-wrap gap-4">
              <Link href="/que-es-un-xray-de-cartera" className="hover:text-gray-700">
                {tNav('whatIsXray')}
              </Link>
              <Link href="/como-funciona" className="hover:text-gray-700">
                {tNav('howItWorks')}
              </Link>
              <Link
                href="/terms"
                className="hover:text-gray-700"
                target="_blank"
                rel="noreferrer"
              >
                {tNav('terms')}
              </Link>
              <Link
                href="/privacy"
                className="hover:text-gray-700"
                target="_blank"
                rel="noreferrer"
              >
                {tNav('privacy')}
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

