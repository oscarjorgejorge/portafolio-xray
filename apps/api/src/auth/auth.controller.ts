import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { MailService } from '../mail/mail.service';
import {
  normalizeLocale,
  type SupportedLocale,
} from '../mail/translations/email-translations';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateLocaleDto,
} from './dto';
import { JwtAuthGuard, GoogleAuthGuard } from './guards';
import { CurrentUser, Public } from './decorators';
import { AuthenticatedUser } from './interfaces';
import { GoogleUser } from './strategies/google.strategy';
import { AppConfig } from '../config';

/** Safely extracts verify-email error fields (auth.service attaches these to BadRequestException). */
function getVerifyEmailErrorFields(err: unknown): {
  userEmail: string | undefined;
  hasRecentToken: boolean;
  expiredTokenId: string | undefined;
  emailVerified: boolean;
  message: string;
} {
  if (err === null || typeof err !== 'object') {
    return {
      userEmail: undefined,
      hasRecentToken: false,
      expiredTokenId: undefined,
      emailVerified: false,
      message: '',
    };
  }
  const o = err as Record<string, unknown>;
  return {
    userEmail: typeof o.userEmail === 'string' ? o.userEmail : undefined,
    hasRecentToken: Boolean(o.hasRecentToken),
    expiredTokenId:
      typeof o.expiredTokenId === 'string' ? o.expiredTokenId : undefined,
    emailVerified: Boolean(o.emailVerified),
    message: err instanceof Error ? err.message : '',
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user with email/password' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'Email or username already exists' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    // Detect locale from Accept-Language header or default to Spanish
    const acceptLanguage = req.get('accept-language');
    const locale: SupportedLocale = normalizeLocale(
      acceptLanguage?.split(',')[0]?.split('-')[0],
    );
    this.logger.log(
      `[REGISTER DEBUG] Accept-Language header: "${acceptLanguage}", Detected locale: "${locale}"`,
    );

    // Register user with locale preference
    const result = await this.authService.register(
      dto,
      ipAddress,
      userAgent,
      locale,
    );

    // Send verification email (don't await to not block response)
    // locale is already validated as SupportedLocale above
    void this.mailService.sendVerificationEmail(
      result.user.email,
      result.verificationToken,
      locale,
    );

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user: result.user,
      tokens: result.tokens,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    const result = await this.authService.login(dto, ipAddress, userAgent);

    return {
      user: result.user,
      tokens: result.tokens,
    };
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth' })
  googleAuth() {
    // Guard redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    try {
      // Check for error from Google OAuth (user denied access)
      const errorParam = req.query.error as string;
      if (errorParam) {
        const frontendUrl =
          this.configService.get('frontendUrl', { infer: true }) ||
          'http://localhost:3000';
        const errorMessage =
          errorParam === 'access_denied'
            ? 'Google authentication was cancelled'
            : `Google authentication failed: ${errorParam}`;
        this.logger.warn(`Google OAuth error: ${errorMessage}`);
        return res.redirect(
          `${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`,
        );
      }

      // Check if user data is available from Google OAuth
      if (!req.user) {
        this.logger.error(
          'Google OAuth callback failed: No user data received',
        );
        throw new Error('Google OAuth callback failed: No user data received');
      }

      const googleUser = req.user as GoogleUser;
      this.logger.log(
        `Google OAuth callback received for user: ${googleUser.email}`,
      );

      // Validate Google user data
      if (!googleUser.email) {
        this.logger.error(
          'Google OAuth callback failed: No email received from Google',
        );
        throw new Error(
          'Google OAuth callback failed: No email received from Google',
        );
      }

      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      // Detect locale from Accept-Language header or default to Spanish
      const locale: SupportedLocale = normalizeLocale(
        req.get('accept-language')?.split(',')[0]?.split('-')[0],
      );

      const result = await this.authService.googleLogin(
        googleUser,
        ipAddress,
        userAgent,
        locale,
      );

      this.logger.log(
        `Google OAuth login successful for user: ${result.user.email}, isNewUser: ${result.isNewUser}`,
      );

      // Redirect to frontend with tokens in query params
      const frontendUrl = this.configService.get('frontendUrl', {
        infer: true,
      });

      if (!frontendUrl) {
        this.logger.error('Frontend URL is not configured');
        throw new Error('Frontend URL is not configured');
      }

      const params = new URLSearchParams({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        isNewUser: result.isNewUser.toString(),
      });

      res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    } catch (error) {
      // Log the error for debugging
      this.logger.error('Google OAuth callback error:', error);
      if (error instanceof Error) {
        this.logger.error(`Error stack: ${error.stack}`);
      }

      // Redirect to frontend with error
      const frontendUrl =
        this.configService.get('frontendUrl', { infer: true }) ||
        'http://localhost:3000';
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication failed';
      res.redirect(
        `${frontendUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshTokens(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    const tokens = await this.authService.refreshTokens(
      dto.refreshToken,
      ipAddress,
      userAgent,
    );

    return { tokens };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 400, description: 'Invalid refresh token format' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logoutAll(user.id);
    return { message: 'Logged out from all devices' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return { user: await this.authService.getCurrentUser(user.id) };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token from email link' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');
    try {
      const result = await this.authService.verifyEmail(
        dto.token,
        ipAddress,
        userAgent,
      );
      return {
        message: 'Email verified successfully',
        user: result.user,
        tokens: result.tokens,
        ...(result.alreadyVerified && { alreadyVerified: true }),
      };
    } catch (err: unknown) {
      const {
        userEmail,
        hasRecentToken,
        expiredTokenId,
        message: errorMessage,
        emailVerified: errorEmailVerified,
      } = getVerifyEmailErrorFields(err);
      const isBadRequest = err instanceof BadRequestException;
      const messageForCheck = isBadRequest ? errorMessage : '';
      const isExpiredToken = messageForCheck.includes('expired');
      const isUsedToken = messageForCheck.includes('already used');

      this.logger.log(
        `[VERIFY EMAIL DEBUG] Token expired check - hasRecentToken: ${hasRecentToken}, expiredTokenId: ${expiredTokenId}, userEmail: ${userEmail}`,
      );

      if (
        userEmail &&
        isBadRequest &&
        isExpiredToken &&
        !isUsedToken &&
        !hasRecentToken
      ) {
        this.logger.log(
          `[VERIFY EMAIL DEBUG] Token expired, auto-resending email to: ${userEmail} (first time only)`,
        );

        let emailSent = false;
        let emailError: string | null = null;

        try {
          // Auto-resend verification email only for expired tokens and only if no recent valid tokens exist
          const result =
            await this.authService.resendVerificationEmail(userEmail);

          // Use locale from user's preference if available, otherwise detect from header
          let locale: SupportedLocale =
            result.locale === 'es' || result.locale === 'en'
              ? result.locale
              : 'es';

          // If user doesn't have a locale preference, detect from Accept-Language header
          if (
            !result.locale ||
            (result.locale !== 'es' && result.locale !== 'en')
          ) {
            const acceptLanguage = req.get('accept-language');
            locale = normalizeLocale(
              acceptLanguage?.split(',')[0]?.split('-')[0],
            );
          }

          // Send verification email and wait for result
          emailSent = await this.mailService.sendVerificationEmail(
            userEmail,
            result.token,
            locale,
          );

          if (emailSent) {
            this.logger.log(
              `[VERIFY EMAIL DEBUG] Auto-resend email sent successfully to ${userEmail} with locale: ${locale}`,
            );
          } else {
            emailError = 'Failed to send verification email';
            this.logger.error(
              `[VERIFY EMAIL DEBUG] Failed to send auto-resend email to ${userEmail}`,
            );
          }
        } catch (resendError) {
          emailError =
            resendError instanceof Error
              ? resendError.message
              : 'Unknown error';
          this.logger.error(
            `[VERIFY EMAIL DEBUG] Failed to auto-resend email: ${emailError}`,
          );
        }

        // Include email send status in error response
        throw new BadRequestException({
          message: errorMessage,
          userEmail,
          emailSent,
          emailError,
        });
      } else if (userEmail && isExpiredToken && hasRecentToken) {
        // Token expired but user already has a recent valid token - don't auto-resend
        this.logger.log(
          `[VERIFY EMAIL DEBUG] Token expired for ${userEmail}, but user already has a recent valid token. Not auto-resending.`,
        );
        throw new BadRequestException({
          message: errorMessage,
          userEmail,
          emailSent: false,
          emailError: null,
        });
      } else if (userEmail && isUsedToken) {
        // Token was already used and email is not verified - auto-resend (already-verified case returns 200 from service)
        const emailVerified = errorEmailVerified;
        if (emailVerified) {
          // Should not reach here: service now returns 200 for already-verified
          throw err;
        }

        this.logger.log(
          `[VERIFY EMAIL DEBUG] Token already used for ${userEmail}, but email is not verified. Auto-resending verification email.`,
        );

        let emailSent = false;
        let emailError: string | null = null;

        try {
          const result =
            await this.authService.resendVerificationEmail(userEmail);

          let locale: SupportedLocale =
            result.locale === 'es' || result.locale === 'en'
              ? result.locale
              : 'es';

          if (
            !result.locale ||
            (result.locale !== 'es' && result.locale !== 'en')
          ) {
            const acceptLanguage = req.get('accept-language');
            locale = normalizeLocale(
              acceptLanguage?.split(',')[0]?.split('-')[0],
            );
          }

          emailSent = await this.mailService.sendVerificationEmail(
            userEmail,
            result.token,
            locale,
          );

          if (emailSent) {
            this.logger.log(
              `[VERIFY EMAIL DEBUG] Auto-resend email sent successfully to ${userEmail} with locale: ${locale}`,
            );
          } else {
            emailError = 'Failed to send verification email';
            this.logger.error(
              `[VERIFY EMAIL DEBUG] Failed to send auto-resend email to ${userEmail}`,
            );
          }
        } catch (resendError) {
          emailError =
            resendError instanceof Error
              ? resendError.message
              : 'Unknown error';
          this.logger.error(
            `[VERIFY EMAIL DEBUG] Failed to auto-resend email: ${emailError}`,
          );
        }

        throw new BadRequestException({
          message: errorMessage,
          userEmail,
          emailSent,
          emailError,
        });
      } else if (userEmail && isExpiredToken) {
        // Token expired but conditions not met for auto-resend
        this.logger.log(
          `[VERIFY EMAIL DEBUG] Token expired for ${userEmail}, but auto-resend conditions not met. isExpiredToken: ${isExpiredToken}, isUsedToken: ${isUsedToken}, hasRecentToken: ${hasRecentToken}`,
        );
        throw new BadRequestException({
          message: errorMessage,
          userEmail,
          emailSent: false,
          emailError: null,
        });
      }
      throw err;
    }
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent if account exists',
  })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Req() req: Request,
  ) {
    try {
      const result = await this.authService.resendVerificationEmail(dto.email);

      // Use locale from user's preference if available, otherwise use header
      let locale: SupportedLocale =
        result.locale === 'es' || result.locale === 'en' ? result.locale : 'es';
      const user = (req as Request & { user?: AuthenticatedUser }).user;
      if (!user) {
        // If not authenticated, try header as fallback
        const acceptLanguage = req.get('accept-language');
        locale = normalizeLocale(acceptLanguage?.split(',')[0]?.split('-')[0]);
        this.logger.log(
          `[RESEND DEBUG] Not authenticated, Accept-Language: "${acceptLanguage}", Using locale: "${locale}"`,
        );
      } else {
        this.logger.log(
          `[RESEND DEBUG] Authenticated user, Using user locale: "${locale}"`,
        );
      }

      // Send verification email (don't await to not block response)
      void this.mailService.sendVerificationEmail(
        dto.email,
        result.token,
        locale,
      );

      return {
        message:
          'If the email exists and is not verified, a verification link has been sent',
      };
    } catch {
      // Always return success message to prevent email enumeration
      return {
        message:
          'If the email exists and is not verified, a verification link has been sent',
      };
    }
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent if account exists',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto.email);

    if (result) {
      // Use locale from user's preference (already included in result)
      // Send password reset email (don't await to not block response)
      const resetLocale: SupportedLocale =
        result.locale === 'es' || result.locale === 'en' ? result.locale : 'es';
      void this.mailService.sendPasswordResetEmail(
        dto.email,
        result.token,
        resetLocale,
      );
    }

    // Always return success to prevent email enumeration
    return {
      message: 'If the email exists, a password reset link has been sent',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token from email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return {
      message:
        'Password reset successfully. Please login with your new password.',
    };
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot change password for OAuth accounts',
  })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto);
    return { message: 'Password changed successfully' };
  }

  @Put('preferences/locale')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user language preference' })
  @ApiResponse({
    status: 200,
    description: 'Language preference updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid locale' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async updateLocale(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLocaleDto,
  ) {
    const updatedUser = await this.authService.updateUserLocale(
      user.id,
      dto.locale,
    );
    return {
      message: 'Language preference updated successfully',
      user: updatedUser,
    };
  }
}
