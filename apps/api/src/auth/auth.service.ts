import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthProvider } from '@prisma/client';
import { AuthRepository } from './auth.repository';
import {
  RegisterDto,
  LoginDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto';
import {
  JwtPayload,
  JwtRefreshPayload,
  TokenPair,
  AuthenticatedUser,
} from './interfaces';
import { GoogleUser } from './strategies/google.strategy';
import { AppConfig } from '../config';

const BCRYPT_ROUNDS = 12;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  // ==========================================
  // Registration
  // ==========================================

  async register(
    dto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
    locale?: string,
  ): Promise<{
    user: AuthenticatedUser;
    tokens: TokenPair;
    verificationToken: string;
  }> {
    // Check if email already exists
    const existingEmail = await this.authRepository.findUserByEmail(dto.email);

    // If email exists but is not verified, allow re-registration
    if (existingEmail) {
      // Check if email is verified
      // emailVerified should be boolean (true/false) per schema
      // Explicitly check for true value - anything else (false, null, undefined) allows re-registration
      const emailVerifiedValue = existingEmail.emailVerified;

      // More explicit check: only block if explicitly true
      // emailVerified is boolean per schema, so we only check for true
      const isEmailVerified = emailVerifiedValue === true;

      // Debug: Log the actual value to help diagnose issues
      this.logger.log(
        `[REGISTER DEBUG] Email: ${dto.email}, emailVerified value: ${JSON.stringify(emailVerifiedValue)}, type: ${typeof emailVerifiedValue}, isVerified: ${isEmailVerified}`,
      );

      // Only block registration if email is explicitly verified
      if (isEmailVerified) {
        this.logger.warn(
          `[REGISTER] Blocked: Email ${dto.email} is already verified`,
        );
        throw new ConflictException('Email already registered');
      }

      this.logger.log(
        `[REGISTER] Allowing re-registration for unverified email: ${dto.email}`,
      );

      // Email exists but is NOT verified - proceed with update and resend verification
      // Check if username conflicts with another verified user
      const existingUserName = await this.authRepository.findUserByUserName(
        dto.userName,
      );
      if (
        existingUserName &&
        existingUserName.id !== existingEmail.id &&
        existingUserName.emailVerified
      ) {
        throw new ConflictException('Username already taken');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

      // Update existing unverified user
      const updateData: {
        userName?: string;
        name?: string;
        password?: string;
        locale?: string;
      } = {
        userName: dto.userName,
        name: dto.name,
        password: hashedPassword,
      };

      // Update locale if provided
      if (locale && (locale === 'es' || locale === 'en')) {
        updateData.locale = locale;
      }

      const updatedUser = await this.authRepository.updateUser(
        existingEmail.id,
        updateData,
      );

      // Generate tokens
      const tokens = await this.generateTokens(
        updatedUser.id,
        updatedUser.email,
        ipAddress,
        userAgent,
      );

      // Create new email verification token
      const verificationToken = await this.createEmailVerificationToken(
        updatedUser.id,
      );

      return {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          userName: updatedUser.userName,
          name: updatedUser.name,
          avatarUrl: updatedUser.avatarUrl,
          emailVerified: updatedUser.emailVerified,
          locale: updatedUser.locale || 'es',
        },
        tokens,
        verificationToken,
      };
    }

    // Check if username already exists (only for verified users)
    const existingUserName = await this.authRepository.findUserByUserName(
      dto.userName,
    );
    if (existingUserName && existingUserName.emailVerified) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Create user with locale preference
    const userLocale =
      locale && (locale === 'es' || locale === 'en') ? locale : 'es';
    const user = await this.authRepository.createUser({
      email: dto.email,
      userName: dto.userName,
      name: dto.name,
      password: hashedPassword,
      provider: AuthProvider.email,
      emailVerified: false,
      locale: userLocale,
    });

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      ipAddress,
      userAgent,
    );

    // Create email verification token
    const verificationToken = await this.createEmailVerificationToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        locale: user.locale || 'es',
      },
      tokens,
      verificationToken,
    };
  }

  // ==========================================
  // Login
  // ==========================================

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: AuthenticatedUser; tokens: TokenPair }> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user has a password (not OAuth only)
    if (!user.password) {
      throw new UnauthorizedException(
        'This account uses Google login. Please sign in with Google.',
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      ipAddress,
      userAgent,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        locale: user.locale || 'es',
      },
      tokens,
    };
  }

  // ==========================================
  // Google OAuth
  // ==========================================

  async googleLogin(
    googleUser: GoogleUser,
    ipAddress?: string,
    userAgent?: string,
    locale?: string,
  ): Promise<{
    user: AuthenticatedUser;
    tokens: TokenPair;
    isNewUser: boolean;
  }> {
    // Check if user exists
    let user = await this.authRepository.findUserByEmail(googleUser.email);
    let isNewUser = false;

    if (!user) {
      // Create new user from Google data
      const userName = await this.generateUniqueUserName(googleUser.email);
      const userLocale =
        locale && (locale === 'es' || locale === 'en') ? locale : 'es';

      user = await this.authRepository.createUser({
        email: googleUser.email,
        userName,
        name: googleUser.name,
        avatarUrl: googleUser.avatarUrl ?? undefined,
        provider: AuthProvider.google,
        emailVerified: true, // Google emails are pre-verified
        locale: userLocale,
      });

      isNewUser = true;
    }

    // Generate tokens
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      ipAddress,
      userAgent,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        userName: user.userName,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        locale: user.locale || 'es',
      },
      tokens,
      isNewUser,
    };
  }

  // ==========================================
  // Token Refresh
  // ==========================================

  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    // Verify the refresh token
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check token type
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Find token in database
    const storedToken =
      await this.authRepository.findRefreshToken(refreshToken);

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Revoke the old refresh token (token rotation)
    await this.authRepository.revokeRefreshToken(refreshToken);

    // Get user
    const user = await this.authRepository.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate new tokens
    return this.generateTokens(user.id, user.email, ipAddress, userAgent);
  }

  // ==========================================
  // Logout
  // ==========================================

  async logout(refreshToken: string): Promise<void> {
    try {
      await this.authRepository.revokeRefreshToken(refreshToken);
    } catch {
      // Token might not exist, that's okay
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.authRepository.revokeAllUserRefreshTokens(userId);
  }

  // ==========================================
  // Email Verification
  // ==========================================

  async verifyEmail(
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    user: AuthenticatedUser;
    tokens: TokenPair;
    alreadyVerified?: boolean;
  }> {
    const verification = await this.authRepository.findEmailVerification(token);

    if (!verification) {
      throw new BadRequestException('Invalid verification token');
    }

    // Get user before checking if token is valid (for auto-resend or already-verified login)
    const user = await this.authRepository.findUserById(verification.userId);
    const userEmail = user?.email;

    if (verification.usedAt) {
      // If token was already used and email is verified, log the user in (return user + tokens)
      if (user?.emailVerified) {
        this.logger.log(
          `[VERIFY EMAIL] Token already used for user ${verification.userId} (email: ${userEmail}). Email verified - returning user and tokens to log in.`,
        );
        const authenticatedUser: AuthenticatedUser = {
          id: user.id,
          email: user.email,
          userName: user.userName,
          name: user.name,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          locale: user.locale || 'es',
        };
        const tokens = await this.generateTokens(
          user.id,
          user.email,
          ipAddress,
          userAgent,
        );
        return { user: authenticatedUser, tokens, alreadyVerified: true };
      }
      // Email not verified - throw so controller can auto-resend
      const error = new BadRequestException('Verification token already used');
      (error as any).userEmail = userEmail;
      (error as any).emailVerified = false;
      this.logger.log(
        `[VERIFY EMAIL] Token already used for user ${verification.userId} (email: ${userEmail}). Email not verified.`,
      );
      throw error;
    }

    if (verification.expiresAt < new Date()) {
      // If token expired, check if user already has a recent valid token (excluding the current expired one)
      // Only auto-resend if no valid tokens exist (first time only)
      let hasRecentToken = false;
      try {
        hasRecentToken =
          await this.authRepository.hasRecentValidVerificationToken(
            verification.userId,
            verification.id, // Exclude the current expired token from the check
          );
      } catch (error) {
        // If there's an error checking for recent tokens, log it but don't fail
        // Default to allowing auto-resend if we can't check
        this.logger.error(
          `Error checking for recent tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        hasRecentToken = false;
      }

      const error = new BadRequestException('Verification token has expired');
      (error as any).userEmail = userEmail;
      (error as any).hasRecentToken = hasRecentToken; // Flag to prevent auto-resend if token exists
      (error as any).expiredTokenId = verification.id; // Include expired token ID for debugging
      throw error;
    }

    // Mark verification as used
    await this.authRepository.markEmailVerificationUsed(verification.id);

    // Mark user email as verified
    const verifiedUser = await this.authRepository.markEmailVerified(
      verification.userId,
    );

    const authenticatedUser: AuthenticatedUser = {
      id: verifiedUser.id,
      email: verifiedUser.email,
      userName: verifiedUser.userName,
      name: verifiedUser.name,
      avatarUrl: verifiedUser.avatarUrl,
      emailVerified: verifiedUser.emailVerified,
      locale: verifiedUser.locale || 'es',
    };

    const tokens = await this.generateTokens(
      verifiedUser.id,
      verifiedUser.email,
      ipAddress,
      userAgent,
    );

    return { user: authenticatedUser, tokens };
  }

  async resendVerificationEmail(email: string): Promise<{
    token: string;
    locale: string;
  }> {
    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      // Don't reveal if user exists
      throw new BadRequestException(
        'If the email exists, a verification link has been sent',
      );
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Create new token (this will invalidate previous unused tokens)
    const token = await this.createEmailVerificationToken(user.id);
    return {
      token,
      locale: user.locale || 'es',
    };
  }

  // ==========================================
  // Password Reset
  // ==========================================

  async forgotPassword(email: string): Promise<{
    token: string;
    locale: string;
  } | null> {
    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      // Don't reveal if user exists - return null but don't throw
      return null;
    }

    // Only allow password reset for email provider users
    if (user.provider !== AuthProvider.email) {
      return null;
    }

    const token = await this.createPasswordResetToken(user.id);
    return {
      token,
      locale: user.locale || 'es',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const reset = await this.authRepository.findPasswordReset(dto.token);

    if (!reset) {
      throw new BadRequestException('Invalid reset token');
    }

    if (reset.usedAt) {
      throw new BadRequestException('Reset token already used');
    }

    if (reset.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    // Update password
    await this.authRepository.updateUserPassword(reset.userId, hashedPassword);

    // Mark reset as used
    await this.authRepository.markPasswordResetUsed(reset.id);

    // Revoke all refresh tokens for security
    await this.authRepository.revokeAllUserRefreshTokens(reset.userId);
  }

  // ==========================================
  // Change Password
  // ==========================================

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException(
        'Cannot change password for OAuth accounts',
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    // Update password
    await this.authRepository.updateUserPassword(userId, hashedPassword);
  }

  // ==========================================
  // Get Current User
  // ==========================================

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      userName: user.userName,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      locale: user.locale || 'es',
    };
  }

  // ==========================================
  // User Preferences
  // ==========================================

  async updateUserLocale(
    userId: string,
    locale: string,
  ): Promise<AuthenticatedUser> {
    // Validate locale
    if (locale !== 'es' && locale !== 'en') {
      throw new BadRequestException('Invalid locale. Must be "es" or "en"');
    }

    const user = await this.authRepository.updateUserLocale(userId, locale);

    return {
      id: user.id,
      email: user.email,
      userName: user.userName,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      locale: user.locale || 'es',
    };
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  private async generateTokens(
    userId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const jwtConfig = this.configService.get('jwt', { infer: true });

    // Generate access token
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'access',
    };

    const accessExpiresInSeconds = this.parseExpirationToSeconds(
      jwtConfig.accessExpiration,
    );
    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: accessExpiresInSeconds,
    });

    // Generate refresh token
    const jti = crypto.randomUUID();
    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      type: 'refresh',
      jti,
    };

    const refreshExpiresInSeconds = this.parseExpirationToSeconds(
      jwtConfig.refreshExpiration,
    );
    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: refreshExpiresInSeconds,
    });

    // Calculate expiration date
    const expiresAt = this.calculateExpirationDate(jwtConfig.refreshExpiration);

    // Store refresh token in database
    await this.authRepository.createRefreshToken({
      token: refreshToken,
      userId,
      expiresAt,
      ipAddress,
      userAgent,
    });

    return { accessToken, refreshToken };
  }

  private async createEmailVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EMAIL_VERIFICATION_EXPIRY_HOURS);

    await this.authRepository.createEmailVerification({
      token,
      userId,
      expiresAt,
    });

    return token;
  }

  private async createPasswordResetToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRY_HOURS);

    await this.authRepository.createPasswordReset({
      token,
      userId,
      expiresAt,
    });

    return token;
  }

  private async generateUniqueUserName(email: string): Promise<string> {
    // Validate email input
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new Error('Invalid email provided for username generation');
    }

    // Extract username from email
    let baseUserName = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    // If baseUserName is empty or too short after cleaning, use a default prefix
    if (!baseUserName || baseUserName.length < 3) {
      // Use a combination of 'user' and a hash of the email for uniqueness
      const emailHash = email
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0)
        .toString(36)
        .substring(0, 6);
      baseUserName = `user${emailHash}`;
    }

    // Ensure it doesn't exceed 30 characters (database constraint)
    if (baseUserName.length > 27) {
      baseUserName = baseUserName.substring(0, 27);
    }

    // Ensure minimum length
    if (baseUserName.length < 3) {
      baseUserName = baseUserName.padEnd(3, '0');
    }

    let userName = baseUserName;
    let suffix = 1;

    // Keep trying until we find a unique username
    while (true) {
      const existingUser =
        await this.authRepository.findUserByUserName(userName);
      if (!existingUser) {
        break; // Found a unique username
      }

      const suffixStr = suffix.toString();
      // Ensure total length doesn't exceed 30 characters
      const maxBaseLength = 30 - suffixStr.length;
      const truncatedBase = baseUserName.substring(
        0,
        Math.max(3, maxBaseLength),
      );
      userName = `${truncatedBase}${suffix}`;
      suffix++;

      // Safety check to prevent infinite loop
      if (suffix > 10000) {
        throw new Error(
          'Unable to generate unique username after many attempts',
        );
      }
    }

    return userName;
  }

  private calculateExpirationDate(expiration: string): Date {
    const now = new Date();
    const match = expiration.match(/^(\d+)([smhd])$/);

    if (!match) {
      // Default to 7 days if parsing fails
      now.setDate(now.getDate() + 7);
      return now;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        now.setSeconds(now.getSeconds() + value);
        break;
      case 'm':
        now.setMinutes(now.getMinutes() + value);
        break;
      case 'h':
        now.setHours(now.getHours() + value);
        break;
      case 'd':
        now.setDate(now.getDate() + value);
        break;
    }

    return now;
  }

  /**
   * Parse expiration string (e.g., '15m', '7d') to seconds
   */
  private parseExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);

    if (!match) {
      // Default to 15 minutes if parsing fails
      return 15 * 60;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 15 * 60;
    }
  }
}
