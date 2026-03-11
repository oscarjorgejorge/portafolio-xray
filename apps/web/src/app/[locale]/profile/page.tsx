'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth';
import { useAuthModal } from '@/lib/auth/AuthModalContext';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { PasswordRequirements } from '@/components/ui/PasswordRequirements';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    updateProfile,
    updateLocale,
    setPassword,
    changePassword,
    logout,
  } = useAuth();
  const { openAuthModal } = useAuthModal();
  const didOpenAuthRef = useRef(false);

  /** OAuth-only users (e.g. Google) have no password; they use "Set password" instead of "Change password" */
  const isSetPasswordFlow = Boolean(user && user.hasPassword === false);

  const [name, setName] = useState('');
  const [userName, setUserName] = useState('');
  const [locale, setLocale] = useState<'es' | 'en'>('es');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Sync form from user
  useEffect(() => {
    if (user) {
      setName(user.name);
      setUserName(user.userName);
      setLocale(user.locale);
    }
  }, [user]);

  // Open auth modal if not authenticated; redirect to home when modal closed without logging in
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user?.emailVerified) {
      if (!didOpenAuthRef.current) {
        didOpenAuthRef.current = true;
        openAuthModal({ tab: 'signin', onCloseWithoutAuth: () => router.replace('/') });
      }
    } else {
      didOpenAuthRef.current = false;
    }
  }, [authLoading, isAuthenticated, user?.emailVerified, openAuthModal, router]);

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setIsSaving(true);
    try {
      const updates: { name?: string; userName?: string } = {};
      if (name.trim() !== user?.name) updates.name = name.trim();
      if (userName.trim() !== user?.userName) updates.userName = userName.trim();
      if (Object.keys(updates).length > 0) {
        await updateProfile(updates);
      }
      const localeChanged = locale !== user?.locale;
      if (localeChanged) {
        await updateLocale(locale);
      }
      setProfileSuccess(t('saveSuccess'));
      // Switch the website to the new locale so URL and UI language match the profile preference
      if (localeChanged) {
        router.replace('/profile', { locale });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setProfileError(t('usernameAlreadyTaken'));
      } else {
        setProfileError(err instanceof Error ? err.message : t('saveError'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('passwordsNoMatch'));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t('passwordTooShort'));
      return;
    }
    setIsChangingPassword(true);
    try {
      await setPassword(newPassword);
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmNewPassword('');
      setProfileSuccess(t('setPasswordSuccess'));
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : t('setPasswordError')
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('passwordsNoMatch'));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t('passwordTooShort'));
      return;
    }
    setIsChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setProfileSuccess(t('changePasswordSuccess'));
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : t('changePasswordError')
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated || !user.emailVerified) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-600 text-center py-8">{t('signInToViewProfile')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:text-blue-500"
          >
            {t('backToHome')}
          </Link>
        </div>

        {profileError && (
          <Alert variant="error">{profileError}</Alert>
        )}
        {profileSuccess && (
          <Alert variant="success">{profileSuccess}</Alert>
        )}

        <form
          onSubmit={handleSubmitProfile}
          className="bg-white shadow rounded-lg p-6 space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              {t('email')}
            </label>
            <Input
              id="email"
              type="email"
              value={user.email}
              readOnly
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              {t('name')}
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
              minLength={2}
              maxLength={100}
            />
          </div>

          <div>
            <label htmlFor="userName" className="block text-sm font-medium text-gray-700">
              {t('userName')}
            </label>
            <Input
              id="userName"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="mt-1"
              placeholder="john_doe"
              minLength={3}
              maxLength={30}
            />
            <p className="mt-1 text-xs text-gray-500">{t('userNameHint')}</p>
          </div>

          <div>
            <label htmlFor="locale" className="block text-sm font-medium text-gray-700">
              Language / Idioma
            </label>
            <select
              id="locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'es' | 'en')}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>

          <Button type="submit" disabled={isSaving} className="w-full">
            {isSaving ? t('saving') : t('save')}
          </Button>
        </form>

        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isSetPasswordFlow ? t('setPasswordTitle') : t('changePasswordTitle')}
          </h2>
          {isSetPasswordFlow && (
            <p className="text-sm text-gray-600">{t('setPasswordHint')}</p>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPasswordError('');
              setShowPasswordModal(true);
            }}
          >
            {isSetPasswordFlow ? t('setPassword') : t('changePassword')}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleLogout}
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {t('logout')}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
          setPasswordError('');
        }}
        title={isSetPasswordFlow ? t('setPasswordTitle') : t('changePasswordTitle')}
        showCloseButton
      >
        <form
          onSubmit={isSetPasswordFlow ? handleSetPassword : handleChangePassword}
          className="space-y-4"
        >
          {passwordError && (
            <Alert variant="error">{passwordError}</Alert>
          )}
          {!isSetPasswordFlow && (
            <PasswordInput
              id="currentPassword"
              label={t('currentPassword')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          )}
          <PasswordInput
            id="newPassword"
            label={t('newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <PasswordRequirements password={newPassword} />
          <PasswordInput
            id="confirmNewPassword"
            label={t('confirmNewPassword')}
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowPasswordModal(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? tCommon('loading') : t('save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
