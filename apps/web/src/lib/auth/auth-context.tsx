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
  
  // Email verification
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  
  // Password management
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  
  // Google OAuth
  getGoogleLoginUrl: () => string;
  
  // Handle OAuth callback
  handleOAuthCallback: (tokens: TokenPair) => Promise<void>;
  
  // Update user state (for email verification, etc.)
  updateUser: (user: User) => void;
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
   * Verify email
   */
  const verifyEmail = useCallback(async (token: string) => {
    const verifiedUser = await authApi.verifyEmail(token);
    // Update user if currently logged in
    if (user?.id === verifiedUser.id) {
      setUser(verifiedUser);
    }
  }, [user?.id]);

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
   * Change password (authenticated)
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
   * Update user state
   */
  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

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
      changePassword,
      getGoogleLoginUrl,
      handleOAuthCallback,
      updateUser,
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
      changePassword,
      getGoogleLoginUrl,
      handleOAuthCallback,
      updateUser,
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
