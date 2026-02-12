import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
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
  ): Promise<{
    user: AuthenticatedUser;
    tokens: TokenPair;
    verificationToken: string;
  }> {
    // Check if email already exists
    const existingEmail = await this.authRepository.findUserByEmail(dto.email);
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    // Check if username already exists
    const existingUserName = await this.authRepository.findUserByUserName(
      dto.userName,
    );
    if (existingUserName) {
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Create user
    const user = await this.authRepository.createUser({
      email: dto.email,
      userName: dto.userName,
      name: dto.name,
      password: hashedPassword,
      provider: AuthProvider.email,
      emailVerified: false,
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

      user = await this.authRepository.createUser({
        email: googleUser.email,
        userName,
        name: googleUser.name,
        avatarUrl: googleUser.avatarUrl ?? undefined,
        provider: AuthProvider.google,
        emailVerified: true, // Google emails are pre-verified
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

  async verifyEmail(token: string): Promise<AuthenticatedUser> {
    const verification = await this.authRepository.findEmailVerification(token);

    if (!verification) {
      throw new BadRequestException('Invalid verification token');
    }

    if (verification.usedAt) {
      throw new BadRequestException('Verification token already used');
    }

    if (verification.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    // Mark verification as used
    await this.authRepository.markEmailVerificationUsed(verification.id);

    // Mark user email as verified
    const user = await this.authRepository.markEmailVerified(
      verification.userId,
    );

    return {
      id: user.id,
      email: user.email,
      userName: user.userName,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
    };
  }

  async resendVerificationEmail(email: string): Promise<string> {
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

    return this.createEmailVerificationToken(user.id);
  }

  // ==========================================
  // Password Reset
  // ==========================================

  async forgotPassword(email: string): Promise<string | null> {
    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      // Don't reveal if user exists - return null but don't throw
      return null;
    }

    // Only allow password reset for email provider users
    if (user.provider !== AuthProvider.email) {
      return null;
    }

    return this.createPasswordResetToken(user.id);
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
    // Extract username from email
    const baseUserName = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    let userName = baseUserName;
    let suffix = 1;

    // Keep trying until we find a unique username
    while (await this.authRepository.findUserByUserName(userName)) {
      userName = `${baseUserName}${suffix}`;
      suffix++;
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
