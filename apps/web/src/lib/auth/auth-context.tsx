'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { User, RegisterData, LoginData, TokenPair, AuthState } from './types';
import { authApi } from './auth-api';
import { tokenStorage } from './token-storage';

/**
 * Auth context value type
 */
interface AuthContextValue extends AuthState {
  // Auth actions
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  
  // Token management
  refreshAuth: () => Promise<void>;
  
  // Email verification (returns user + alreadyVerified so caller can redirect with correct query)
  verifyEmail: (token: string) => Promise<{ user: User; alreadyVerified?: boolean }>;
  resendVerification: (email: string) => Promise<void>;
  
  // Password management
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  setPassword: (newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  
  // Google OAuth
  getGoogleLoginUrl: () => string;
  
  // Handle OAuth callback
  handleOAuthCallback: (tokens: TokenPair) => Promise<void>;
  
  // Update user state (for email verification, etc.)
  updateUser: (user: User) => void;
  
  // Update user profile (name, userName)
  updateProfile: (data: { userName?: string; name?: string }) => Promise<void>;
  
  // Update user language preference
  updateLocale: (locale: 'es' | 'en') => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth Provider component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = useMemo(() => !!user, [user]);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we have tokens
        if (!tokenStorage.hasTokens()) {
          setIsLoading(false);
          return;
        }

        // If access token is expired, try to refresh
        if (tokenStorage.isAccessTokenExpired()) {
          try {
            await authApi.refreshTokens();
          } catch {
            // Refresh failed, clear tokens
            tokenStorage.clearTokens();
            setIsLoading(false);
            return;
          }
        }

        // Fetch current user
        const currentUser = await authApi.getCurrentUser();
        setUser(currentUser);
      } catch {
        // Failed to get user, clear tokens
        tokenStorage.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Login with email/password
   */
  const login = useCallback(async (data: LoginData) => {
    const response = await authApi.login(data);
    setUser(response.user);
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (data: RegisterData) => {
    const response = await authApi.register(data);
    setUser(response.user);
  }, []);

  /**
   * Logout current session
   */
  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  /**
   * Logout from all devices
   */
  const logoutAll = useCallback(async () => {
    await authApi.logoutAll();
    setUser(null);
  }, []);

  /**
   * Refresh authentication
   */
  const refreshAuth = useCallback(async () => {
    try {
      await authApi.refreshTokens();
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
    } catch {
      tokenStorage.clearTokens();
      setUser(null);
    }
  }, []);

  /**
   * Verify email. Stores tokens and sets user on success. Returns { user, alreadyVerified } for redirect.
   */
  const verifyEmail = useCallback(
    async (token: string): Promise<{ user: User; alreadyVerified?: boolean }> => {
      const result = await authApi.verifyEmail(token);
      const verifiedUser = result.user;
      if (!user || user.id === verifiedUser.id) {
        setUser(verifiedUser);
      }
      if (user && user.id !== verifiedUser.id && tokenStorage.hasTokens()) {
        try {
          const currentUser = await authApi.getCurrentUser();
          setUser(currentUser);
        } catch {
          setUser(verifiedUser);
        }
      }
      return result;
    },
    [user],
  );

  /**
   * Resend verification email
   */
  const resendVerification = useCallback(async (email: string) => {
    await authApi.resendVerification(email);
  }, []);

  /**
   * Request password reset
   */
  const forgotPassword = useCallback(async (email: string) => {
    await authApi.forgotPassword(email);
  }, []);

  /**
   * Reset password with token
   */
  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    await authApi.resetPassword(token, newPassword);
  }, []);

  /**
   * Set password for OAuth-only accounts (no current password required)
   */
  const setPassword = useCallback(async (newPassword: string) => {
    await authApi.setPassword(newPassword);
    const updatedUser = await authApi.getCurrentUser();
    setUser(updatedUser);
  }, []);

  /**
   * Change password (authenticated, for accounts that already have a password)
   */
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await authApi.changePassword(currentPassword, newPassword);
    },
    []
  );

  /**
   * Get Google OAuth URL
   */
  const getGoogleLoginUrl = useCallback(() => {
    return authApi.getGoogleLoginUrl();
  }, []);

  /**
   * Handle OAuth callback
   */
  const handleOAuthCallback = useCallback(async (tokens: TokenPair) => {
    tokenStorage.setTokens(tokens);
    const currentUser = await authApi.getCurrentUser();
    setUser(currentUser);
  }, []);

  /**
   * Update user language preference
   */
  const updateLocale = useCallback(async (locale: 'es' | 'en') => {
    if (!isAuthenticated) {
      return; // Don't update if not authenticated
    }

    try {
      const updatedUser = await authApi.updateUserLocale(locale);
      setUser(updatedUser);
    } catch (error) {
      // Silently fail - don't block language change in UI
      console.error('Failed to update user locale preference:', error);
    }
  }, [isAuthenticated]);

  /**
   * Update user state
   */
  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  /**
   * Update user profile (name, userName)
   */
  const updateProfile = useCallback(
    async (data: { userName?: string; name?: string }) => {
      const updatedUser = await authApi.updateProfile(data);
      setUser(updatedUser);
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      register,
      logout,
      logoutAll,
      refreshAuth,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      setPassword,
      changePassword,
      getGoogleLoginUrl,
      handleOAuthCallback,
      updateUser,
      updateProfile,
      updateLocale,
    }),
    [
      user,
      isAuthenticated,
      isLoading,
      login,
      register,
      logout,
      logoutAll,
      refreshAuth,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      setPassword,
      changePassword,
      getGoogleLoginUrl,
      handleOAuthCallback,
      updateUser,
      updateProfile,
      updateLocale,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
