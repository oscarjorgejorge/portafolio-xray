'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PageLoading } from '@/components/ui/PageLoading';

function VerifyEmailPendingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.verifyEmailPending');
  const tVerify = useTranslations('auth.verifyEmail');
  const { user, isAuthenticated, resendVerification } = useAuth();
  
  const [email, setEmail] = useState<string>('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const [showRegisteredMessage, setShowRegisteredMessage] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isCooldownActive, setIsCooldownActive] = useState(false);
  const countdownInitializedRef = useRef(false);

  useEffect(() => {
    // Get email from query param or from authenticated user
    const emailParam = searchParams.get('email');
    const registeredParam = searchParams.get('registered');
    const errorParam = searchParams.get('error');
    const failedParam = searchParams.get('failed');
    const autoSentParam = searchParams.get('autoSent');
    
    if (emailParam) {
      setEmail(emailParam);
    } else if (user?.email) {
      setEmail(user.email);
    }

    if (registeredParam === 'true') {
      setShowRegisteredMessage(true);
    }

    // Show verification error if coming from failed verification
    if (failedParam === 'true' && errorParam) {
      const decodedError = decodeURIComponent(errorParam);
      // Translate common error messages
      let translatedError = decodedError;
      if (decodedError.includes('already used') || decodedError.includes('ya fue utilizado')) {
        translatedError = tVerify('verificationFailedUsed');
      } else if (decodedError.includes('expired') || decodedError.includes('expirado')) {
        translatedError = tVerify('verificationFailedExpired');
      } else if (decodedError.includes('Invalid') || decodedError.includes('inválido')) {
        translatedError = tVerify('verificationFailedInvalid');
      } else {
        translatedError = tVerify('verificationFailed');
      }
      setVerificationError(translatedError);
      
      // If email was auto-sent by backend, show success message and start cooldown
      // Only initialize countdown once to prevent it from restarting
      if (autoSentParam === 'true' && !countdownInitializedRef.current) {
        setResendSuccess(true);
        // Start cooldown timer since email was automatically sent by backend
        setCountdown(60);
        setIsCooldownActive(true);
        countdownInitializedRef.current = true;
      } else if (autoSentParam !== 'true') {
        // If no auto-sent, don't show success message
        setResendSuccess(false);
      }
    }

    // If user is authenticated and email is already verified, redirect to home
    if (isAuthenticated && user?.emailVerified && failedParam !== 'true') {
      router.push('/');
    }
  }, [searchParams, user, isAuthenticated, router, tVerify]);

  // Countdown timer effect
  useEffect(() => {
    // Only run timer if cooldown is active and countdown is greater than 0
    if (!isCooldownActive || countdown <= 0) {
      // Ensure cooldown is deactivated when countdown reaches 0 or is not active
      if (isCooldownActive && countdown <= 0) {
        setIsCooldownActive(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => {
        const newCount = prev - 1;
        if (newCount <= 0) {
          setIsCooldownActive(false);
          return 0;
        }
        return newCount;
      });
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, isCooldownActive]);

  const handleResend = async () => {
    if (!email) {
      setResendError('Email address is required');
      return;
    }

    if (isCooldownActive) {
      return; // Prevent clicking during cooldown
    }

    setIsResending(true);
    setResendError('');
    setResendSuccess(false);

    try {
      await resendVerification(email);
      setResendSuccess(true);
      // Start cooldown timer
      setIsCooldownActive(true);
      setCountdown(60);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoToHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
            <svg
              className="h-8 w-8 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {t('subtitle')}
          </p>
        </div>

        {verificationError && (
          <Alert variant="error">
            <div className="font-semibold mb-1">{tVerify('failed')}</div>
            <div>{verificationError}</div>
            {searchParams.get('autoSent') === 'true' && (
              <div className="mt-2 text-sm">{t('verificationFailedMessage')}</div>
            )}
          </Alert>
        )}

        {showRegisteredMessage && !verificationError && (
          <Alert variant="success">
            {t('registrationSuccess')}
          </Alert>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <p className="text-sm text-gray-700 mb-4">
              {t('instructions')}
            </p>
            {email && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {t('emailLabel')}
                </p>
                <p className="text-sm text-gray-700">{email}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                {t('checkSpam')}
              </p>
              <p className="text-sm text-gray-600">
                {t('expiryNotice')}
              </p>
            </div>

            {resendSuccess && searchParams.get('autoSent') === 'true' && (
              <Alert variant="success">
                {t('resendSuccess')}
              </Alert>
            )}

            {resendError && (
              <Alert variant="error">
                {resendError}
              </Alert>
            )}

            <Button
              onClick={handleResend}
              disabled={isResending || !email || isCooldownActive}
              className="w-full"
            >
              {isCooldownActive && `${t('resendButton')} (${countdown}s)`}
            {!isCooldownActive && isResending && t('resending')}
            {!isCooldownActive && !isResending && t('resendButton')}
            </Button>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <Button
              onClick={handleGoToHome}
              variant="secondary"
              className="w-full"
            >
              {t('backToHome')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPendingPage() {
  const tCommon = useTranslations('common');
  
  return (
    <Suspense fallback={<PageLoading message={tCommon('loading')} />}>
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
