import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthProvider,
  User,
  RefreshToken,
  PasswordReset,
  EmailVerification,
} from '@prisma/client';

export interface CreateUserData {
  email: string;
  userName: string;
  name: string;
  password?: string;
  avatarUrl?: string;
  provider: AuthProvider;
  emailVerified?: boolean;
}

export interface CreateRefreshTokenData {
  token: string;
  userId: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface CreatePasswordResetData {
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface CreateEmailVerificationData {
  token: string;
  userId: string;
  expiresAt: Date;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // User Operations
  // ==========================================

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findUserByUserName(userName: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { userName: userName.toLowerCase() },
    });
  }

  async createUser(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        userName: data.userName.toLowerCase(),
        name: data.name,
        password: data.password,
        avatarUrl: data.avatarUrl,
        provider: data.provider,
        emailVerified: data.emailVerified ?? false,
      },
    });
  }

  async updateUserPassword(
    userId: string,
    hashedPassword: string,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  // ==========================================
  // Refresh Token Operations
  // ==========================================

  async createRefreshToken(
    data: CreateRefreshTokenData,
  ): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      },
    });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async revokeRefreshToken(token: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpiredRefreshTokens(): Promise<{ count: number }> {
    return this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });
  }

  // ==========================================
  // Password Reset Operations
  // ==========================================

  async createPasswordReset(
    data: CreatePasswordResetData,
  ): Promise<PasswordReset> {
    // Invalidate any existing unused tokens for this user
    await this.prisma.passwordReset.updateMany({
      where: {
        userId: data.userId,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    return this.prisma.passwordReset.create({
      data: {
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findPasswordReset(token: string): Promise<PasswordReset | null> {
    return this.prisma.passwordReset.findUnique({
      where: { token },
    });
  }

  async markPasswordResetUsed(id: string): Promise<PasswordReset> {
    return this.prisma.passwordReset.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  // ==========================================
  // Email Verification Operations
  // ==========================================

  async createEmailVerification(
    data: CreateEmailVerificationData,
  ): Promise<EmailVerification> {
    // Invalidate any existing unused tokens for this user
    await this.prisma.emailVerification.updateMany({
      where: {
        userId: data.userId,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    return this.prisma.emailVerification.create({
      data: {
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findEmailVerification(
    token: string,
  ): Promise<EmailVerification | null> {
    return this.prisma.emailVerification.findUnique({
      where: { token },
    });
  }

  async markEmailVerificationUsed(id: string): Promise<EmailVerification> {
    return this.prisma.emailVerification.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
