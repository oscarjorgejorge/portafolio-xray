'use client';

import { ReactNode } from 'react';
import { Sidebar } from '@/components/navigation/Sidebar';
import { useAuth } from '@/lib/auth';

interface MainWithSidebarProps {
  children: ReactNode;
}

/**
 * Renders Sidebar only when the user is authenticated and verified (sidebar has content).
 * On public views (no auth), the sidebar is hidden and main content uses full width.
 */
export function MainWithSidebar({ children }: MainWithSidebarProps) {
  const { isAuthenticated, user } = useAuth();
  const showSidebar = isAuthenticated && user?.emailVerified;

  return (
    <>
      {showSidebar && <Sidebar />}
      <main
        className={`pb-16 md:pb-0 ${showSidebar ? 'md:pl-56' : ''}`}
      >
        {children}
      </main>
    </>
  );
}
