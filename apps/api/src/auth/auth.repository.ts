import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthProvider,
  User,
  RefreshToken,
  PasswordReset,
  EmailVerification,
  Prisma,
} from '@prisma/client';

export interface CreateUserData {
  email: string;
  userName: string;
  name: string;
  password?: string;
  avatarUrl?: string;
  provider: AuthProvider;
  emailVerified?: boolean;
  locale?: string; // User language preference: 'es' or 'en', defaults to 'es'
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

const ANONYMIZED_EMAIL_PREFIX = 'anonymous_email_';
const ANONYMIZED_USERNAME_PREFIX = 'anonymous_user_name_';
const ANONYMIZED_NAME_PREFIX = 'anonymous_name_';

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // User Operations
  // ==========================================

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, isDeleted: false },
    });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), isDeleted: false },
    });
  }

  async findUserByUserName(userName: string): Promise<User | null> {
    // Validate input
    if (
      !userName ||
      typeof userName !== 'string' ||
      userName.trim().length === 0
    ) {
      return null;
    }

    const normalizedUserName = userName.toLowerCase().trim();

    // Ensure minimum length (database constraint)
    if (normalizedUserName.length < 3) {
      return null;
    }

    return this.prisma.user.findFirst({
      where: { userName: normalizedUserName, isDeleted: false },
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
        locale: data.locale || 'es', // Default to Spanish
      },
    });
  }

  async updateUser(
    userId: string,
    data: {
      userName?: string;
      name?: string;
      password?: string;
      locale?: string;
    },
  ): Promise<User> {
    const updateData: {
      userName?: string;
      name?: string;
      password?: string;
      locale?: string;
    } = {};

    if (data.userName) {
      updateData.userName = data.userName.toLowerCase();
    }
    if (data.name) {
      updateData.name = data.name;
    }
    if (data.password) {
      updateData.password = data.password;
    }
    if (data.locale) {
      updateData.locale = data.locale;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async updateUserLocale(userId: string, locale: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { locale },
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

  /**
   * Soft delete a user and hide all their portfolios.
   * - Marks user as isDeleted=true and anonymizes personal data.
   * - Marks all portfolios for that user as isDeleted=true and isPublic=false.
   */
  async softDeleteUserAndPortfolios(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const seq = await tx.anonymizedUserSequence.upsert({
        where: { id: 1 },
        update: { nextValue: { increment: 1 } },
        create: { id: 1, nextValue: 1 },
      });
      const anonymizedIndex = seq.nextValue;
      const deletedAt = new Date();

      await tx.user.update({
        where: { id: userId },
        data: this.buildAnonymizedUserData(anonymizedIndex, deletedAt),
      });

      await tx.portfolio.updateMany({
        where: { userId },
        data: {
          isPublic: false,
          isDeleted: true,
          deletedAt,
        },
      });
    });
  }

  private buildAnonymizedUserData(
    anonymizedIndex: number,
    deletedAt: Date,
  ): Prisma.UserUpdateInput {
    const suffix = String(anonymizedIndex);

    return {
      email: `${ANONYMIZED_EMAIL_PREFIX}${suffix}@mail.com`,
      userName: `${ANONYMIZED_USERNAME_PREFIX}${suffix}`,
      name: `${ANONYMIZED_NAME_PREFIX}${suffix}`,
      avatarUrl: null,
      password: null,
      emailVerified: false,
      isDeleted: true,
      deletedAt,
    };
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

  /**
   * Check if user has any recent unused and non-expired verification tokens
   * Used to determine if auto-resend should happen (only if no valid tokens exist)
   * @param userId - User ID to check
   * @param excludeTokenId - Optional token ID to exclude from check (e.g., the expired token being verified)
   */
  async hasRecentValidVerificationToken(
    userId: string,
    excludeTokenId?: string,
  ): Promise<boolean> {
    const whereClause: Prisma.EmailVerificationWhereInput = {
      userId,
      usedAt: null,
      expiresAt: {
        gt: new Date(), // Not expired
      },
      createdAt: {
        // Only consider tokens created in the last 24 hours as "recent"
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      ...(excludeTokenId && {
        id: { not: excludeTokenId },
      }),
    };

    try {
      const recentTokens = await this.prisma.emailVerification.findFirst({
        where: whereClause,
        orderBy: {
          createdAt: 'desc', // Get the most recent one
        },
      });

      const hasToken = recentTokens !== null;

      // Log for debugging
      this.logger.log(
        `hasRecentValidVerificationToken - userId: ${userId}, excludeTokenId: ${excludeTokenId || 'none'}, hasToken: ${hasToken}`,
      );

      return hasToken;
    } catch (error) {
      // If there's an error with the database query, log it and return false
      // This allows the auto-resend to proceed if we can't verify
      this.logger.error(
        `Error checking for recent valid tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false; // Default to allowing auto-resend if we can't check
    }
  }
}
