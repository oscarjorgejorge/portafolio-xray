import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthProvider } from '@prisma/client';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { AppConfig } from '../config';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

const mockJwtConfig = {
  secret: 'test-secret',
  accessExpiration: '15m',
  refreshExpiration: '7d',
};

const mockUser = {
  id: 'user-1',
  email: 'user@example.com',
  userName: 'testuser',
  name: 'Test User',
  password: 'hashed_password',
  avatarUrl: null,
  provider: AuthProvider.email,
  emailVerified: true,
  locale: 'es',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUnverifiedUser = {
  ...mockUser,
  emailVerified: false,
};

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: jest.Mocked<AuthRepository>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const mockAuthRepository = {
      findUserByEmail: jest.fn(),
      findUserByUserName: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      createRefreshToken: jest.fn().mockResolvedValue(undefined),
      findRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      findUserById: jest.fn(),
      findEmailVerification: jest.fn(),
      markEmailVerificationUsed: jest.fn().mockResolvedValue(undefined),
      markEmailVerified: jest.fn(),
      createEmailVerification: jest.fn().mockResolvedValue(undefined),
      createPasswordReset: jest.fn().mockResolvedValue(undefined),
      findPasswordReset: jest.fn(),
      markPasswordResetUsed: jest.fn().mockResolvedValue(undefined),
      updateUserPassword: jest.fn().mockResolvedValue(undefined),
      revokeAllUserRefreshTokens: jest.fn().mockResolvedValue(undefined),
      hasRecentValidVerificationToken: jest.fn().mockResolvedValue(false),
    };

    const mockJwtService = {
      sign: jest.fn().mockImplementation((payload: { type?: string }) => {
        return payload.type === 'refresh' ? 'refresh-token' : 'access-token';
      }),
      verify: jest.fn().mockReturnValue({ sub: mockUser.id, type: 'refresh' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: keyof AppConfig) => {
              if (key === 'jwt') return mockJwtConfig;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authRepository = module.get(AuthRepository);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('should create new user and return user, tokens, and verification token', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.findUserByUserName.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({
        ...mockUnverifiedUser,
        id: 'new-user-id',
        email: 'new@example.com',
        userName: 'newuser',
      });

      const result = await service.register(
        {
          email: 'new@example.com',
          userName: 'newuser',
          name: 'New User',
          password: 'password123',
        },
        '127.0.0.1',
        'test-agent',
        'es',
      );

      expect(result.user.email).toBe('new@example.com');
      expect(result.user.emailVerified).toBe(false);
      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.tokens.refreshToken).toBe('refresh-token');
      expect(result.verificationToken).toBeDefined();
      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          userName: 'newuser',
          provider: AuthProvider.email,
          emailVerified: false,
        }),
      );
    });

    it('should throw ConflictException when email is already verified', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      authRepository.findUserByUserName.mockResolvedValue(null);

      await expect(
        service.register(
          {
            email: mockUser.email,
            userName: 'othername',
            name: 'Other',
            password: 'pass',
          },
          undefined,
          undefined,
          'es',
        ),
      ).rejects.toThrow(ConflictException);

      expect(authRepository.createUser).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when username is taken by another verified user', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.findUserByUserName.mockResolvedValue(mockUser);

      await expect(
        service.register(
          {
            email: 'other@example.com',
            userName: mockUser.userName,
            name: 'Other',
            password: 'pass',
          },
          undefined,
          undefined,
          'es',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return user and tokens for valid credentials', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);

      const result = await service.login(
        { email: mockUser.email, password: 'correct' },
        '127.0.0.1',
      );

      expect(result.user.id).toBe(mockUser.id);
      expect(result.tokens.accessToken).toBe('access-token');
      expect(bcrypt.compare).toHaveBeenCalledWith('correct', mockUser.password);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: mockUser.email, password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when user has no password (OAuth-only account)', async () => {
      authRepository.findUserByEmail.mockResolvedValue({
        ...mockUser,
        password: null,
        provider: AuthProvider.google,
      });

      await expect(
        service.login({ email: mockUser.email, password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens and revoke old refresh token', async () => {
      authRepository.findRefreshToken.mockResolvedValue({
        id: 'rt-1',
        token: 'old-refresh',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
        userAgent: null,
        ipAddress: null,
      });
      authRepository.findUserById.mockResolvedValue(mockUser);

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(
        'valid-refresh-token',
      );
    });

    it('should throw when refresh token is invalid (JWT verify fails)', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when token type is not refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: mockUser.id, type: 'access' });
      authRepository.findRefreshToken.mockResolvedValue({
        id: 'rt-1',
        token: 'x',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        createdAt: new Date(),
        userAgent: null,
        ipAddress: null,
      });

      await expect(service.refreshTokens('access-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw when refresh token is revoked', async () => {
      jwtService.verify.mockReturnValue({ sub: mockUser.id, type: 'refresh' });
      authRepository.findRefreshToken.mockResolvedValue({
        id: 'rt-1',
        token: 'x',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(),
        createdAt: new Date(),
        userAgent: null,
        ipAddress: null,
      });

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should return authenticated user', async () => {
      authRepository.findUserById.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser(mockUser.id);

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      authRepository.findUserById.mockResolvedValue(null);

      await expect(service.getCurrentUser('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('should mark token used and email verified, return user and tokens', async () => {
      authRepository.findEmailVerification.mockResolvedValue({
        id: 'ev-1',
        token: 'token123',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        createdAt: new Date(),
      });
      authRepository.markEmailVerified.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      });

      const result = await service.verifyEmail('token123');

      expect(result.user.emailVerified).toBe(true);
      expect(result.tokens.accessToken).toBeDefined();
      expect(authRepository.markEmailVerificationUsed).toHaveBeenCalledWith(
        'ev-1',
      );
    });

    it('should throw when token is invalid', async () => {
      authRepository.findEmailVerification.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return user and alreadyVerified when token already used and email verified', async () => {
      authRepository.findEmailVerification.mockResolvedValue({
        id: 'ev-1',
        token: 'used',
        userId: mockUser.id,
        expiresAt: new Date(),
        usedAt: new Date(),
        createdAt: new Date(),
      });
      authRepository.findUserById.mockResolvedValue(mockUser);

      const result = await service.verifyEmail('used');

      expect(result.alreadyVerified).toBe(true);
      expect(result.user.emailVerified).toBe(true);
    });
  });

  describe('resendVerificationEmail', () => {
    it('should return new token for unverified user', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUnverifiedUser);

      const result = await service.resendVerificationEmail(mockUser.email);

      expect(result.token).toBeDefined();
      expect(result.locale).toBe('es');
    });

    it('should throw when email is already verified', async () => {
      authRepository.findUserByEmail.mockResolvedValue(mockUser);

      await expect(
        service.resendVerificationEmail(mockUser.email),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('forgotPassword', () => {
    it('should return null for non-existent email (no enumeration)', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('unknown@example.com');

      expect(result).toBeNull();
    });

    it('should return null for Google provider user', async () => {
      authRepository.findUserByEmail.mockResolvedValue({
        ...mockUser,
        provider: AuthProvider.google,
      });

      const result = await service.forgotPassword(mockUser.email);

      expect(result).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('should throw when token is invalid', async () => {
      authRepository.findPasswordReset.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'invalid',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when token already used', async () => {
      authRepository.findPasswordReset.mockResolvedValue({
        id: 'pr-1',
        token: 'x',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(),
        createdAt: new Date(),
      });

      await expect(
        service.resetPassword({
          token: 'x',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should throw when current password is wrong', async () => {
      authRepository.findUserById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser.id, {
          currentPassword: 'wrong',
          newPassword: 'newpass',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for OAuth-only user', async () => {
      authRepository.findUserById.mockResolvedValue({
        ...mockUser,
        password: null,
        provider: AuthProvider.google,
      });

      await expect(
        service.changePassword(mockUser.id, {
          currentPassword: 'any',
          newPassword: 'newpass',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProfile', () => {
    it('should throw ConflictException when username is taken by another verified user', async () => {
      authRepository.findUserByUserName.mockResolvedValue({
        ...mockUser,
        id: 'other-id',
      });

      await expect(
        service.updateProfile(mockUser.id, { userName: mockUser.userName }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateUserLocale', () => {
    it('should throw when locale is invalid', async () => {
      await expect(service.updateUserLocale(mockUser.id, 'fr')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('googleLogin', () => {
    const googleUser = {
      email: 'google@example.com',
      name: 'Google User',
      avatarUrl: null,
      googleId: 'google-123',
    };

    it('should create new user and return isNewUser true', async () => {
      authRepository.findUserByEmail.mockResolvedValue(null);
      authRepository.findUserByUserName.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({
        ...mockUser,
        id: 'google-new-id',
        email: googleUser.email,
        provider: AuthProvider.google,
        emailVerified: true,
      });

      const result = await service.googleLogin(googleUser);

      expect(result.isNewUser).toBe(true);
      expect(result.user.email).toBe(googleUser.email);
      expect(authRepository.createUser).toHaveBeenCalled();
    });

    it('should return existing user with isNewUser false', async () => {
      authRepository.findUserByEmail.mockResolvedValue({
        ...mockUser,
        email: googleUser.email,
        provider: AuthProvider.google,
      });

      const result = await service.googleLogin(googleUser);

      expect(result.isNewUser).toBe(false);
      expect(authRepository.createUser).not.toHaveBeenCalled();
    });
  });
});
