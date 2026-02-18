/**
 * Token pair returned after successful authentication
 */
export interface TokenPair {
  /** Short-lived access token for API requests */
  accessToken: string;
  /** Long-lived refresh token for obtaining new access tokens */
  refreshToken: string;
}

/**
 * Authenticated user data attached to request
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  userName: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  locale: string; // User language preference: 'es' or 'en'
}
