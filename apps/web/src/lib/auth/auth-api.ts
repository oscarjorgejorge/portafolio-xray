import { apiClient, ApiError } from '../api/client';
import { tokenStorage } from './token-storage';
import {
  User,
  TokenPair,
  RegisterData,
  LoginData,
  AuthResponse,
  RefreshResponse,
  CurrentUserResponse,
} from './types';

/**
 * Flag to prevent multiple simultaneous refresh attempts
 */
let isRefreshing = false;
let refreshPromise: Promise<TokenPair> | null = null;

/**
 * Auth API functions
 */
export const authApi = {
  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    tokenStorage.setTokens(response.data.tokens);
    return response.data;
  },

  /**
   * Login with email and password
   */
  async login(data: LoginData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    tokenStorage.setTokens(response.data.tokens);
    return response.data;
  },

  /**
   * Get current user (requires authentication)
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<CurrentUserResponse>('/auth/me');
    return response.data.user;
  },

  /**
   * Refresh access token
   */
  async refreshTokens(): Promise<TokenPair> {
    // Prevent multiple simultaneous refresh attempts
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      throw new ApiError('No refresh token available', 401);
    }

    isRefreshing = true;
    refreshPromise = (async () => {
      try {
        const response = await apiClient.post<RefreshResponse>('/auth/refresh', {
          refreshToken,
        });
        tokenStorage.setTokens(response.data.tokens);
        return response.data.tokens;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  /**
   * Logout (revoke refresh token)
   */
  async logout(): Promise<void> {
    const refreshToken = tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refreshToken });
      } catch {
        // Ignore errors during logout
      }
    }
    tokenStorage.clearTokens();
  },

  /**
   * Logout from all devices
   */
  async logoutAll(): Promise<void> {
    try {
      await apiClient.post('/auth/logout-all');
    } catch {
      // Ignore errors
    }
    tokenStorage.clearTokens();
  },

  /**
   * Verify email with token. On success returns user and stores tokens (user is logged in).
   */
  async verifyEmail(token: string): Promise<{ user: User; alreadyVerified?: boolean }> {
    const response = await apiClient.post<{
      user: User;
      message: string;
      tokens?: TokenPair;
      alreadyVerified?: boolean;
    }>('/auth/verify-email', { token });
    if (response.data.tokens) {
      tokenStorage.setTokens(response.data.tokens);
    }
    return {
      user: response.data.user,
      alreadyVerified: response.data.alreadyVerified,
    };
  },

  /**
   * Resend verification email
   */
  async resendVerification(email: string): Promise<void> {
    await apiClient.post('/auth/resend-verification', { email });
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, newPassword });
  },

  /**
   * Set password for OAuth-only accounts (no current password required)
   */
  async setPassword(newPassword: string): Promise<void> {
    await apiClient.post('/auth/set-password', { newPassword });
  },

  /**
   * Change password (authenticated, for accounts that already have a password)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  },

  /**
   * Update user profile (name, userName)
   */
  async updateProfile(data: {
    userName?: string;
    name?: string;
  }): Promise<User> {
    const response = await apiClient.patch<{ user: User }>(
      '/auth/profile',
      data
    );
    return response.data.user;
  },

  /**
   * Update user language preference
   */
  async updateUserLocale(locale: 'es' | 'en'): Promise<User> {
    const response = await apiClient.put<{ user: User; message: string }>(
      '/auth/preferences/locale',
      { locale }
    );
    return response.data.user;
  },

  /**
   * Get Google OAuth URL
   */
  getGoogleLoginUrl(): string {
    // This will redirect to Google OAuth
    return `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  },
};

// Configure API client to refresh access tokens transparently before requests
apiClient.setRefreshCallback(async () => {
  try {
    await authApi.refreshTokens();
  } catch (error) {
    // If refresh fails, clear tokens so the app can redirect to login
    tokenStorage.clearTokens();
    throw error;
  }
});
