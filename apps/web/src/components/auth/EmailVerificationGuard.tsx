'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';

interface EmailVerificationGuardProps {
  children: React.ReactNode;
}

/**
 * EmailVerificationGuard component
 * 
 * Protects routes by ensuring the user's email is verified.
 * If email is not verified, redirects to verify-email-pending page.
 */
export function EmailVerificationGuard({ children }: EmailVerificationGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) {
      return;
    }

    // Don't redirect if already on verification pages
    if (pathname?.includes('/verify-email')) {
      return;
    }

    // Only check if user is authenticated
    if (isAuthenticated && user) {
      // If email is not verified, redirect to verification pending page
      if (!user.emailVerified) {
        const email = user.email ? encodeURIComponent(user.email) : '';
        router.push(`/verify-email-pending${email ? `?email=${email}` : ''}`);
      }
    }
  }, [user, isAuthenticated, isLoading, router, pathname]);

  // Don't render children if email is not verified (unless on verification pages)
  if (isAuthenticated && user && !user.emailVerified && !pathname?.includes('/verify-email')) {
    return null;
  }

  return children;
}
