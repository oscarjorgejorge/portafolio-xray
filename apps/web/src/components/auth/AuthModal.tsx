'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PasswordRequirements } from '@/components/ui/PasswordRequirements';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/lib/auth';
import { isValidEmail } from '@/lib/utils';

const PENDING_SAVE_PORTFOLIO_KEY = 'pendingSavePortfolio';

export function setPendingSavePortfolio(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(PENDING_SAVE_PORTFOLIO_KEY, '1');
  }
}

export function getPendingSavePortfolio(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(PENDING_SAVE_PORTFOLIO_KEY) === '1';
}

export function clearPendingSavePortfolio(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(PENDING_SAVE_PORTFOLIO_KEY);
  }
}

export type AuthModalTab = 'signin' | 'register' | 'forgotPassword';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user is authenticated (and email verified when required). Opens save portfolio form. */
  onAuthSuccess: () => void;
  /** Initial tab when modal opens. */
  initialTab?: AuthModalTab;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess, initialTab: initialTabProp = 'signin' }: AuthModalProps) {
  const router = useRouter();
  const tLogin = useTranslations('auth.login');
  const tRegister = useTranslations('auth.register');
  const tForgot = useTranslations('auth.forgotPassword');
  const tAuthModal = useTranslations('authModal');
  const tValidation = useTranslations('validation');
  const { login, register, forgotPassword, getGoogleLoginUrl, user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [tab, setTab] = useState<AuthModalTab>(initialTabProp);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerData, setRegisterData] = useState({
    email: '',
    userName: '',
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [forgotError, setForgotError] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTabProp);
      setForgotStatus('idle');
      setForgotError('');
    }
  }, [isOpen, initialTabProp]);

  const handleLoginSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (!loginEmail.trim()) {
        setError(tValidation('fieldRequired'));
        return;
      }
      if (!isValidEmail(loginEmail)) {
        setError(tValidation('emailInvalid'));
        return;
      }
      setIsLoading(true);
      try {
        await login({ email: loginEmail, password: loginPassword });
        if (user?.emailVerified) {
          onAuthSuccess();
        } else {
          onAuthSuccess();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : tLogin('loginFailed');
        setError(
          msg.toLowerCase().includes('invalid credentials')
            ? tLogin('invalidCredentials')
            : msg
        );
      } finally {
        setIsLoading(false);
      }
    },
    [login, loginEmail, loginPassword, onAuthSuccess, tLogin, tValidation, user?.emailVerified]
  );

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegisterData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const getRegisterErrorMessage = useCallback(
    (err: unknown): string => {
      if (!(err instanceof Error)) return tRegister('registrationFailed');
      const msg = err.message.toLowerCase();
      if (msg.includes('email already registered')) return tRegister('emailAlreadyRegistered');
      if (msg.includes('username already taken')) return tRegister('usernameAlreadyTaken');
      return err.message || tRegister('registrationFailed');
    },
    [tRegister]
  );

  const handleRegisterSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (!registerData.email.trim()) {
        setError(tValidation('fieldRequired'));
        return;
      }
      if (!isValidEmail(registerData.email)) {
        setError(tValidation('emailInvalid'));
        return;
      }
      if (registerData.password !== registerData.confirmPassword) {
        setError(tRegister('passwordsNoMatch'));
        return;
      }
      if (registerData.password.length < 6) {
        setError(tRegister('passwordTooShort'));
        return;
      }
      if (!acceptTerms) {
        setError(tRegister('acceptTermsError'));
        return;
      }
      setIsLoading(true);
      try {
        await register({
          email: registerData.email,
          userName: registerData.userName,
          name: registerData.name,
          password: registerData.password,
        });
        setPendingSavePortfolio();
        setRegisterSuccess(true);
      } catch (err) {
        setError(getRegisterErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [acceptTerms, getRegisterErrorMessage, register, registerData, tRegister, tValidation]
  );

  const handleGoogleLogin = () => {
    window.location.href = getGoogleLoginUrl();
  };

  const handleForgotSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setForgotError('');
      if (!forgotEmail.trim()) {
        setForgotError(tValidation('fieldRequired'));
        return;
      }
      if (!isValidEmail(forgotEmail)) {
        setForgotError(tValidation('emailInvalid'));
        return;
      }
      setForgotStatus('loading');
      try {
        await forgotPassword(forgotEmail);
        setForgotStatus('success');
      } catch (err) {
        setForgotStatus('error');
        setForgotError(err instanceof Error ? err.message : tForgot('sendError'));
      }
    },
    [forgotPassword, forgotEmail, tForgot, tValidation]
  );

  const handleClose = useCallback(() => {
    setError('');
    setForgotStatus('idle');
    setForgotError('');
    setForgotEmail('');
    setTab('signin');
    setRegisterSuccess(false);
    setLoginEmail('');
    setLoginPassword('');
    setRegisterData({
      email: '',
      userName: '',
      name: '',
      password: '',
      confirmPassword: '',
    });
    setAcceptTerms(false);
    onClose();
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    if (isAuthenticated && user?.emailVerified) {
      onAuthSuccess();
    }
  }, [isOpen, isAuthenticated, user?.emailVerified, onAuthSuccess]);

  const content = () => {
    if (registerSuccess) {
      return (
        <div className="space-y-4">
          <Alert variant="success">{tAuthModal('verifyEmailMessage')}</Alert>
          <p className="text-sm text-gray-600">
            {tAuthModal('verifyEmailHint')}
          </p>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              handleClose();
              router.push(`/verify-email-pending?email=${encodeURIComponent(registerData.email)}&registered=true`);
            }}
          >
            {tAuthModal('goToVerify')}
          </Button>
        </div>
      );
    }

    if (tab === 'forgotPassword') {
      if (forgotStatus === 'success') {
        return (
          <div className="space-y-4">
            <div className="flex justify-center h-12 w-12 rounded-full bg-green-100 mx-auto">
              <svg className="h-6 w-6 text-green-600 m-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center">{tForgot('checkEmail')}</h3>
            <p className="text-sm text-gray-600 text-center">
              {tForgot('checkEmailMessage', { email: forgotEmail })}
            </p>
            <p className="text-sm text-gray-500 text-center">{tForgot('checkSpam')}</p>
            <Button type="button" className="w-full" onClick={() => { setTab('signin'); setForgotStatus('idle'); }}>
              {tForgot('backToLogin')}
            </Button>
          </div>
        );
      }
      return (
        <form onSubmit={handleForgotSubmit} className="space-y-4" noValidate>
          {forgotError && <Alert variant="error">{forgotError}</Alert>}
          <p className="text-sm text-gray-600">{tForgot('subtitle')}</p>
          <div>
            <label htmlFor="auth-modal-forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
              {tForgot('emailLabel')}
            </label>
            <Input
              id="auth-modal-forgot-email"
              type="email"
              autoComplete="email"
              required
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder={tForgot('emailPlaceholder')}
              className="w-full"
            />
          </div>
          <Button type="submit" className="w-full" disabled={forgotStatus === 'loading'}>
            {forgotStatus === 'loading' ? tForgot('sending') : tForgot('sendLink')}
          </Button>
          <button
            type="button"
            onClick={() => { setTab('signin'); setForgotError(''); }}
            className="w-full text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {tForgot('backToLogin')}
          </button>
        </form>
      );
    }

    if (tab === 'signin') {
      return (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          <div>
            <label htmlFor="auth-modal-email" className="block text-sm font-medium text-gray-700 mb-1">
              {tLogin('email')}
            </label>
            <Input
              id="auth-modal-email"
              type="email"
              autoComplete="email"
              required
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <PasswordInput
              id="auth-modal-password"
              label={tLogin('password')}
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full"
            />
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => { setTab('forgotPassword'); setError(''); }}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                {tLogin('forgotPassword')}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? tLogin('signingIn') : tLogin('signIn')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full flex items-center justify-center"
            onClick={handleGoogleLogin}
          >
            <span className="mr-2">{tLogin('continueWithGoogle')}</span>
          </Button>
        </form>
      );
    }

    return (
      <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
        {error && <Alert variant="error">{error}</Alert>}
        <div>
          <label htmlFor="auth-modal-reg-email" className="block text-sm font-medium text-gray-700 mb-1">
            {tRegister('email')}
          </label>
          <Input
            id="auth-modal-reg-email"
            name="email"
            type="email"
            required
            value={registerData.email}
            onChange={handleRegisterChange}
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="auth-modal-reg-userName" className="block text-sm font-medium text-gray-700 mb-1">
            {tRegister('userName')}
          </label>
          <Input
            id="auth-modal-reg-userName"
            name="userName"
            type="text"
            required
            value={registerData.userName}
            onChange={handleRegisterChange}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">{tRegister('userNameHint')}</p>
        </div>
        <div>
          <label htmlFor="auth-modal-reg-name" className="block text-sm font-medium text-gray-700 mb-1">
            {tRegister('name')}
          </label>
          <Input
            id="auth-modal-reg-name"
            name="name"
            type="text"
            required
            value={registerData.name}
            onChange={handleRegisterChange}
            className="w-full"
          />
        </div>
        <div>
          <PasswordInput
            id="auth-modal-reg-password"
            name="password"
            label={tRegister('password')}
            value={registerData.password}
            onChange={handleRegisterChange}
            required
            minLength={6}
            className="w-full"
          />
          <PasswordRequirements password={registerData.password} />
        </div>
        <div>
          <PasswordInput
            id="auth-modal-reg-confirmPassword"
            name="confirmPassword"
            label={tRegister('confirmPassword')}
            value={registerData.confirmPassword}
            onChange={handleRegisterChange}
            required
            className="w-full"
          />
        </div>
        <div className="flex items-start space-x-2">
          <input
            id="auth-modal-reg-accept-terms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            required
          />
          <label
            htmlFor="auth-modal-reg-accept-terms"
            className="text-xs text-gray-600"
          >
            {tRegister.rich('acceptTermsLabel', {
              terms: (chunks) => (
                <Link
                  href="/terms"
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/privacy"
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {chunks}
                </Link>
              ),
            })}
          </label>
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? tRegister('creatingAccount') : tRegister('createAccount')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleGoogleLogin}
        >
          {tRegister('continueWithGoogle')}
        </Button>
      </form>
    );
  };

  let modalTitle: string;
  if (registerSuccess) {
    modalTitle = tAuthModal('checkEmail');
  } else if (tab === 'forgotPassword') {
    modalTitle = tForgot('title');
  } else {
    modalTitle = tAuthModal('title');
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      showCloseButton
      maxWidth="md"
    >
      {!registerSuccess && tab !== 'forgotPassword' && (
        <div className="flex border-b border-gray-200 mb-4 -mx-6 px-6">
          <button
            type="button"
            onClick={() => { setTab('signin'); setError(''); }}
            className={`py-2 px-4 text-sm font-medium border-b-2 -mb-px ${
              tab === 'signin'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tLogin('signIn')}
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); }}
            className={`py-2 px-4 text-sm font-medium border-b-2 -mb-px ${
              tab === 'register'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tRegister('createAccount')}
          </button>
        </div>
      )}
      {!registerSuccess && tab === 'forgotPassword' && (
        <div className="mb-4 -mx-6 px-6">
          <button
            type="button"
            onClick={() => { setTab('signin'); setForgotError(''); setForgotStatus('idle'); }}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            ← {tForgot('backToLogin')}
          </button>
        </div>
      )}
      {authLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        content()
      )}
    </Modal>
  );
}
