import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT Authentication Guard
 *
 * Attempts to authenticate but allows request to proceed even if no token is provided.
 * Useful for routes that have different behavior for authenticated vs anonymous users.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtOptionalGuard)
 * @Get('portfolios/:slug')
 * getPortfolio(@CurrentUser() user?: AuthenticatedUser) {
 *   // user will be populated if authenticated, undefined otherwise
 * }
 * ```
 */
@Injectable()
export class JwtOptionalGuard extends AuthGuard('jwt') {
  /**
   * Allow request to proceed even without valid token
   * Note: info and context params are required by passport but not used here
   */
  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | false,
    ...rest: unknown[] // info and context are required by passport but not used
  ): TUser | null {
    // Silence unused variable warning - passport requires these params
    void rest;

    // Don't throw error if no user - just return null
    if (err || !user) {
      return null;
    }
    return user;
  }
}
