/**
 * User data returned from authentication
 */
export interface User {
  id: string;
  email: string;
  userName: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}

/**
 * Token pair for authentication
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Auth state
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Register request data
 */
export interface RegisterData {
  email: string;
  userName: string;
  name: string;
  password: string;
}

/**
 * Login request data
 */
export interface LoginData {
  email: string;
  password: string;
}

/**
 * Auth response from register/login
 */
export interface AuthResponse {
  user: User;
  tokens: TokenPair;
  message?: string;
}

/**
 * Refresh tokens response
 */
export interface RefreshResponse {
  tokens: TokenPair;
}

/**
 * Current user response
 */
export interface CurrentUserResponse {
  user: User;
}
