import { TokenPair } from './types';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Token storage utilities
 * Uses localStorage for persistence across browser sessions
 */
export const tokenStorage = {
  /**
   * Get the access token
   */
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  /**
   * Get the refresh token
   */
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Store both tokens
   */
  setTokens(tokens: TokenPair): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Check if tokens exist
   */
  hasTokens(): boolean {
    return !!this.getAccessToken() && !!this.getRefreshToken();
  },

  /**
   * Decode JWT payload (without verification)
   * Used to check token expiration client-side
   */
  decodeToken(token: string): { exp?: number; sub?: string } | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  },

  /**
   * Check if access token is expired (with 30 second buffer)
   */
  isAccessTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;

    const decoded = this.decodeToken(token);
    if (!decoded?.exp) return true;

    // Add 30 second buffer before expiration
    const expiresAt = decoded.exp * 1000;
    return Date.now() >= expiresAt - 30000;
  },
};
