import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { MailService } from '../src/mail/mail.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

const mockAuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  userName: 'testuser',
  name: 'Test User',
  avatarUrl: null,
  emailVerified: true,
  locale: 'es',
};

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  getCurrentUser: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerificationEmail: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
  updateProfile: jest.fn(),
  updateUserLocale: jest.fn(),
  googleLogin: jest.fn(),
};

const mockMailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: MailService, useValue: mockMailService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockAuthenticatedUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should return 201 with user and tokens', async () => {
      mockAuthService.register.mockResolvedValue({
        user: mockAuthenticatedUser,
        tokens: { accessToken: 'at', refreshToken: 'rt' },
        verificationToken: 'vt',
      });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'new@example.com',
          userName: 'newuser',
          name: 'New User',
          password: 'Password123!',
        })
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.tokens).toBeDefined();
      expect(res.body.message).toContain('verify');
      expect(mockAuthService.register).toHaveBeenCalled();
      expect(mockAuthService.register.mock.calls[0][0]).toMatchObject({
        email: 'new@example.com',
        userName: 'newuser',
        name: 'New User',
        password: 'Password123!',
      });
    });
  });

  describe('POST /auth/login', () => {
    it('should return 200 with user and tokens', async () => {
      mockAuthService.login.mockResolvedValue({
        user: mockAuthenticatedUser,
        tokens: { accessToken: 'at', refreshToken: 'rt' },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'pass' })
        .expect(200);

      expect(res.body.user.email).toBe('user@example.com');
      expect(res.body.tokens.accessToken).toBe('at');
      expect(mockAuthService.login).toHaveBeenCalled();
      expect(mockAuthService.login.mock.calls[0][0]).toEqual({
        email: 'user@example.com',
        password: 'pass',
      });
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 200 with new tokens', async () => {
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-at',
        refreshToken: 'new-rt',
      });

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'old-rt' })
        .expect(200);

      expect(res.body.tokens.accessToken).toBe('new-at');
      expect(mockAuthService.refreshTokens).toHaveBeenCalled();
      expect(mockAuthService.refreshTokens.mock.calls[0][0]).toBe('old-rt');
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 200 with message', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'rt' })
        .expect(200);

      expect(res.body.message).toContain('Logged out');
      expect(mockAuthService.logout).toHaveBeenCalledWith('rt');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 200 with current user when authenticated', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(mockAuthenticatedUser);

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(200);

      expect(res.body.user.id).toBe(mockAuthenticatedUser.id);
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
      );
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should return 200 with user and tokens on valid token', async () => {
      mockAuthService.verifyEmail.mockResolvedValue({
        user: mockAuthenticatedUser,
        tokens: { accessToken: 'at', refreshToken: 'rt' },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: 'valid-token' })
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.tokens).toBeDefined();
      expect(mockAuthService.verifyEmail).toHaveBeenCalled();
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should return 200 and not reveal whether email exists', async () => {
      mockAuthService.forgotPassword.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'unknown@example.com' })
        .expect(200);

      expect(res.body.message).toContain('password reset');
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should return 200 on valid token', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'valid-token', newPassword: 'NewPass123!' })
        .expect(200);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith({
        token: 'valid-token',
        newPassword: 'NewPass123!',
      });
    });
  });

  describe('PATCH /auth/profile', () => {
    it('should return 200 with updated user', async () => {
      const updated = { ...mockAuthenticatedUser, name: 'Updated Name' };
      mockAuthService.updateProfile.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/auth/profile')
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.user.name).toBe('Updated Name');
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        { name: 'Updated Name' },
      );
    });
  });

  describe('PUT /auth/change-password', () => {
    it('should return 200 on valid current password', async () => {
      mockAuthService.changePassword.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put('/auth/change-password')
        .send({
          currentPassword: 'old',
          newPassword: 'NewPass123!',
        })
        .expect(200);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        mockAuthenticatedUser.id,
        { currentPassword: 'old', newPassword: 'NewPass123!' },
      );
    });
  });
});
