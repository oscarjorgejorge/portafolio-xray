import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/** Request augmented with the failure reason when Google OAuth does not yield a user. */
export type GoogleAuthRequest = Request & { googleAuthError?: string };

/**
 * Google OAuth Authentication Guard
 *
 * Initiates Google OAuth flow when applied to a route.
 *
 * On the callback route, failures (user cancelled, code exchange rejected,
 * missing profile data) do not throw: the guard leaves `req.user` empty and
 * stores the reason in `req.googleAuthError`, so the controller can redirect
 * the browser back to the frontend instead of showing a raw API error page.
 *
 * @example
 * ```typescript
 * @UseGuards(GoogleAuthGuard)
 * @Get('google')
 * googleLogin() {
 *   // Redirects to Google OAuth
 * }
 *
 * @UseGuards(GoogleAuthGuard)
 * @Get('google/callback')
 * googleCallback(@Req() req) {
 *   // Handle callback with req.user containing GoogleUser
 * }
 * ```
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const req = context.switchToHttp().getRequest<GoogleAuthRequest>();
      req.googleAuthError = describeAuthFailure(err, info);
      return undefined as TUser;
    }
    return user;
  }
}

function describeAuthFailure(err: unknown, info: unknown): string {
  // passport-oauth2 TokenError/InternalOAuthError carry Google's error code
  // (e.g. invalid_client, invalid_grant, redirect_uri_mismatch).
  const source = err ?? info;
  if (source && typeof source === 'object') {
    const o = source as Record<string, unknown>;
    const code = typeof o.code === 'string' ? o.code : undefined;
    const message =
      source instanceof Error ? source.message : (o.message as string);
    if (code && message && !message.includes(code)) {
      return `${message} (${code})`;
    }
    if (message) return message;
    if (code) return code;
  }
  return 'Google authentication failed';
}
