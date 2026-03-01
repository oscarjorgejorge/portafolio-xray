'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Alert } from '@/components/ui/Alert';

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const token = searchParams.get('token');

  const isValid =
    password.length >= 8 && password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('idle');

    if (!token) {
      setStatus('error');
      setError(t('invalidLink'));
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setError(t('passwordsNoMatch'));
      return;
    }

    if (password.length < 8) {
      setStatus('error');
      setError(t('passwordTooShort'));
      return;
    }

    setStatus('loading');

    try {
      await resetPassword(token, password);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : t('resetError'));
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <Alert variant="error">
            {t('invalidLinkMessage')}
          </Alert>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            {t('requestNewLink')}
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">{t('successTitle')}</h2>
          <p className="mt-2 text-gray-600">
            {t('successMessage')}
          </p>
          <Button onClick={() => router.push('/login')} className="mt-6 w-full">
            {t('goToLogin')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-center text-gray-900">
            Portfolio X-Ray
          </h1>
          <h2 className="mt-6 text-center text-xl font-semibold text-gray-700">
            {t('title')}
          </h2>
        </div>

        {(status === 'error' && error) && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <PasswordInput
              id="password"
              label={t('newPassword')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (status === 'error') {
                  setStatus('idle');
                  setError('');
                }
              }}
              autoComplete="new-password"
              required
              minLength={8}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('passwordHint')}
            </p>
            <PasswordInput
              id="confirmPassword"
              label={t('confirmPassword')}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (status === 'error') {
                  setStatus('idle');
                  setError('');
                }
              }}
              autoComplete="new-password"
              required
              minLength={8}
              className="mt-1"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={status === 'loading' || !isValid}
          >
            {status === 'loading' ? t('resetting') : t('submit')}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          {t('rememberPassword')}{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            {t('signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
