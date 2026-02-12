import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtStrategy, GoogleStrategy } from './strategies';
import { JwtAuthGuard, JwtOptionalGuard, GoogleAuthGuard } from './guards';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfig } from '../config';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const jwtConfig = configService.get('jwt', { infer: true });
        return {
          secret: jwtConfig.secret,
          // Note: expiresIn will be set per-call in AuthService
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    JwtStrategy,
    GoogleStrategy,
    JwtAuthGuard,
    JwtOptionalGuard,
    GoogleAuthGuard,
  ],
  exports: [AuthService, AuthRepository, JwtAuthGuard, JwtOptionalGuard],
})
export class AuthModule {}
