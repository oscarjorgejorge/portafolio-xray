'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail, user, isAuthenticated } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  
  const token = searchParams.get('token');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setError('No verification token provided');
        return;
      }

      try {
        await verifyEmail(token);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      }
    };

    verify();
  }, [token, verifyEmail]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Verification Failed</h2>
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
          <div className="mt-6 space-y-3">
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
            {isAuthenticated && !user?.emailVerified && (
              <Link href="/settings" className="block text-sm text-blue-600 hover:text-blue-500">
                Resend verification email
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Email Verified!</h2>
        <p className="mt-2 text-gray-600">
          Your email has been successfully verified. You can now use all features of Portfolio X-Ray.
        </p>
        <Button onClick={() => router.push('/')} className="mt-6 w-full">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
