'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      await forgotPassword(email);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Check your email</h2>
          <p className="mt-2 text-gray-600">
            If an account exists with {email}, we&apos;ve sent a password reset link.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Don&apos;t see it? Check your spam folder.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            Back to login
          </Link>
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
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {status === 'error' && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Remember your password?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
