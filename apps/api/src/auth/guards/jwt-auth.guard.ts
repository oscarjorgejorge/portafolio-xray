import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT Authentication Guard
 *
 * Protects routes requiring authentication.
 * Respects @Public() decorator to allow unauthenticated access.
 *
 * @example
 * ```typescript
 * // Protect a single route
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile() { ... }
 *
 * // Apply globally in app.module.ts and use @Public() for exceptions
 * @Public()
 * @Get('health')
 * healthCheck() { ... }
 * ```
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Check if the route should be authenticated
   */
  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Proceed with JWT authentication
    return super.canActivate(context);
  }
}
