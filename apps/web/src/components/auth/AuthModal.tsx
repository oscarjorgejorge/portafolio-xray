'use client';

import React, { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/lib/auth';

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

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user is authenticated (and email verified when required). Opens save portfolio form. */
  onAuthSuccess: () => void;
}

type Tab = 'signin' | 'register';

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const router = useRouter();
  const tLogin = useTranslations('auth.login');
  const tRegister = useTranslations('auth.register');
  const tAuthModal = useTranslations('authModal');
  const { login, register, getGoogleLoginUrl, user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>('signin');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerData, setRegisterData] = useState({
    email: '',
    userName: '',
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const handleLoginSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);
      try {
        await login({ email: loginEmail, password: loginPassword });
        if (user?.emailVerified) {
          onAuthSuccess();
        } else {
          onAuthSuccess();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : tLogin('loginFailed'));
      } finally {
        setIsLoading(false);
      }
    },
    [login, loginEmail, loginPassword, onAuthSuccess, tLogin, user?.emailVerified]
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
      if (registerData.password !== registerData.confirmPassword) {
        setError(tRegister('passwordsNoMatch'));
        return;
      }
      if (registerData.password.length < 8) {
        setError(tRegister('passwordTooShort'));
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
    [getRegisterErrorMessage, register, registerData, tRegister]
  );

  const handleGoogleLogin = () => {
    window.location.href = getGoogleLoginUrl();
  };

  const handleClose = useCallback(() => {
    setError('');
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
      <form onSubmit={handleRegisterSubmit} className="space-y-4">
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
            minLength={8}
            className="w-full"
          />
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={registerSuccess ? tAuthModal('checkEmail') : tAuthModal('title')}
      showCloseButton
      maxWidth="md"
    >
      {!registerSuccess && (
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
