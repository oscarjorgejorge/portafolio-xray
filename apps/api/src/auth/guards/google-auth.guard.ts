import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Google OAuth Authentication Guard
 *
 * Initiates Google OAuth flow when applied to a route.
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
export class GoogleAuthGuard extends AuthGuard('google') {}
