/**
 * JWT Access Token payload structure
 */
export interface JwtPayload {
  /** User ID */
  sub: string;
  /** User email */
  email: string;
  /** Token type for validation */
  type: 'access';
  /** Issued at timestamp */
  iat?: number;
  /** Expiration timestamp */
  exp?: number;
}

/**
 * JWT Refresh Token payload structure
 */
export interface JwtRefreshPayload {
  /** User ID */
  sub: string;
  /** Token type for validation */
  type: 'refresh';
  /** Token ID for revocation tracking */
  jti: string;
  /** Issued at timestamp */
  iat?: number;
  /** Expiration timestamp */
  exp?: number;
}
