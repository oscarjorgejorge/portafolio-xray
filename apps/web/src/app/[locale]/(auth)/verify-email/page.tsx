'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.verifyEmail');
  const { verifyEmail, user, isAuthenticated, refreshAuth, resendVerification } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const token = searchParams.get('token');
  /** Prevent double run (e.g. React Strict Mode) so we only send one verify-email request per token */
  const verificationAttemptedForTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setError(t('noToken'));
        setTimeout(() => {
          router.push('/verify-email-pending?error=noToken');
        }, 2000);
        return;
      }

      // If user is already authenticated and verified, redirect to home without calling API (avoids rate limit)
      if (isAuthenticated && user?.emailVerified) {
        setStatus('success');
        setTimeout(() => {
          router.push('/?alreadyVerified=true');
        }, 500);
        return;
      }

      // Only one verification request per token (avoids double send in Strict Mode or double mount)
      if (verificationAttemptedForTokenRef.current === token) {
        return;
      }
      verificationAttemptedForTokenRef.current = token;

      try {
        const result = await verifyEmail(token);
        if (isAuthenticated) {
          await refreshAuth();
        }
        setStatus('success');
        const query = result?.alreadyVerified ? 'alreadyVerified=true' : 'verified=true';
        setTimeout(() => {
          router.push(`/?${query}`);
        }, 2000);
      } catch (err) {
        const apiError = err && typeof err === 'object' ? (err as { status?: number; data?: unknown }) : null;
        const isRateLimited = apiError?.status === 429;

        if (isRateLimited) {
          // 429: no email was sent, show rate limit message and redirect without autoSent
          setStatus('error');
          setError(t('tooManyRequests'));
          setTimeout(() => {
            const emailToUse = user?.email || searchParams.get('email');
            router.push(
              `/verify-email-pending?email=${encodeURIComponent(emailToUse || '')}&error=${encodeURIComponent(t('tooManyRequests'))}&failed=true`,
            );
          }, 2500);
          return;
        }

        let errorMessage = err instanceof Error ? err.message : t('verificationFailed');
        let userEmail: string | undefined;
        let emailSent = true;
        let emailError: string | null = null;
        let emailVerified = false;

        if (apiError?.data) {
          const errorData = apiError.data as Record<string, unknown>;
          userEmail = (errorData.userEmail as string) ?? userEmail;
          if (typeof errorData.emailSent === 'boolean') emailSent = errorData.emailSent;
          if (errorData.emailError != null) emailError = String(errorData.emailError);
          if (errorData.emailVerified === true) emailVerified = true;
          if (typeof errorData.message === 'string') errorMessage = errorData.message;
          if (errorData.message && typeof errorData.message === 'object' && errorData.message !== null) {
            const msg = errorData.message as Record<string, unknown>;
            if (msg.userEmail != null) userEmail = String(msg.userEmail);
            if (typeof msg.emailSent === 'boolean') emailSent = msg.emailSent;
            if (msg.emailError != null) emailError = String(msg.emailError);
            if (msg.emailVerified === true) emailVerified = true;
            if (typeof msg.message === 'string') errorMessage = msg.message;
          }
        }

        if (emailVerified) {
          router.push('/?alreadyVerified=true');
          return;
        }

        if (errorMessage.includes('already used')) {
          errorMessage = t('verificationFailedUsed');
        } else if (errorMessage.includes('expired')) {
          errorMessage = t('verificationFailedExpired');
        } else if (errorMessage.includes('Invalid')) {
          errorMessage = t('verificationFailedInvalid');
        }

        setStatus('error');
        setError(errorMessage);

        if (!emailSent && emailError) {
          setTimeout(() => {
            router.push('/register?emailSendFailed=true');
          }, 2000);
          return;
        }

        const emailToUse = userEmail || user?.email || searchParams.get('email');
        const autoSentParam = emailSent ? '&autoSent=true' : '';
        setTimeout(() => {
          router.push(
            `/verify-email-pending?email=${encodeURIComponent(emailToUse || '')}&error=${encodeURIComponent(errorMessage)}&failed=true${autoSentParam}`,
          );
        }, 2000);
      }
    };

    verify();
  }, [token, verifyEmail, refreshAuth, isAuthenticated, t, router, user, resendVerification, searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">{t('verifying')}</p>
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
          <h2 className="mt-4 text-xl font-semibold text-gray-900">{t('failed')}</h2>
          <Alert variant="error" className="mt-4">
            {t('redirectingMessage')}
          </Alert>
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
        <h2 className="mt-4 text-xl font-semibold text-gray-900">{t('success')}</h2>
        <p className="mt-2 text-gray-600">
          {t('successMessage')}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {t('redirectingMessage')}
        </p>
      </div>
    </div>
  );
}
