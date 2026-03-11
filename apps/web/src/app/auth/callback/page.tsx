'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { routing } from '@/i18n/routing';

/**
 * OAuth callback redirect page
 * Redirects to the locale-specific callback page
 * This handles the case where the backend redirects to /auth/callback
 * instead of /[locale]/auth/callback
 */
export default function AuthCallbackRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Get the default locale or use 'es' as fallback
    const defaultLocale = routing.defaultLocale || 'es';
    const searchParams = typeof window !== 'undefined' ? window.location.search : '';
    
    // Redirect to locale-specific callback page preserving all query params
    router.replace(`/${defaultLocale}/auth/callback${searchParams}`);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
