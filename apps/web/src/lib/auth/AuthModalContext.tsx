'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth';
import { AuthModal } from '@/components/auth/AuthModal';

export type AuthModalTab = 'signin' | 'register' | 'forgotPassword';

export interface OpenAuthModalOptions {
  tab?: AuthModalTab;
  /** If set, called when modal is closed and user is still not authenticated (e.g. redirect to home). */
  onCloseWithoutAuth?: () => void;
}

interface AuthModalContextValue {
  openAuthModal: (options?: OpenAuthModalOptions) => void;
  /** Opens modal and returns a promise that resolves when the modal is closed (after login or on close). */
  openAuthModalAndWait: () => Promise<void>;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error('useAuthModal must be used within AuthModalProvider');
  }
  return ctx;
}

interface AuthModalProviderProps {
  children: ReactNode;
}

export function AuthModalProvider({ children }: AuthModalProviderProps) {
  const { isAuthenticated, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<AuthModalTab>('signin');
  const onCloseWithoutAuthRef = useRef<(() => void) | null>(null);
  const pendingResolveRef = useRef<(() => void) | null>(null);

  const openAuthModal = useCallback((options?: OpenAuthModalOptions) => {
    setInitialTab(options?.tab ?? 'signin');
    onCloseWithoutAuthRef.current = options?.onCloseWithoutAuth ?? null;
    setIsOpen(true);
  }, []);

  const openAuthModalAndWait = useCallback(
    () =>
      new Promise<void>((resolve) => {
        pendingResolveRef.current = resolve;
        setInitialTab('signin');
        onCloseWithoutAuthRef.current = null;
        setIsOpen(true);
      }),
    []
  );

  const handleClose = useCallback(() => {
    const wasAuthenticated = isAuthenticated && user?.emailVerified;
    setIsOpen(false);
    pendingResolveRef.current?.();
    pendingResolveRef.current = null;
    if (!wasAuthenticated && onCloseWithoutAuthRef.current) {
      onCloseWithoutAuthRef.current();
      onCloseWithoutAuthRef.current = null;
    }
  }, [isAuthenticated, user?.emailVerified]);

  const handleAuthSuccess = useCallback(() => {
    pendingResolveRef.current?.();
    pendingResolveRef.current = null;
    onCloseWithoutAuthRef.current = null;
    setIsOpen(false);
  }, []);

  const value: AuthModalContextValue = {
    openAuthModal,
    openAuthModalAndWait,
  };

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal
        isOpen={isOpen}
        onClose={handleClose}
        onAuthSuccess={handleAuthSuccess}
        initialTab={initialTab}
      />
    </AuthModalContext.Provider>
  );
}
