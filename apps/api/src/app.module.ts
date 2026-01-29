import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config';
import type { AppConfig } from './config';
import { PrismaModule } from './prisma/prisma.module';
import { AssetsModule } from './assets/assets.module';
import { XRayModule } from './xray/xray.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { HttpClientModule } from './common/http';
import { LoggerModule } from './common/logger';
import {
  RequestIdInterceptor,
  TransformResponseInterceptor,
} from './common/interceptors';
import { RequestLoggerMiddleware } from './common/middleware';

@Module({
  imports: [
    // Configuration module - validates env vars at startup
    ConfigModule,
    // Global logger module with request ID correlation
    LoggerModule,
    // Global HTTP client for all modules
    HttpClientModule,
    // In-memory cache for frequently accessed assets
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const cacheConfig = configService.get('cache', { infer: true });
        return {
          ttl: cacheConfig.ttlMs,
          max: cacheConfig.maxItems,
        };
      },
    }),
    // Rate limiting configuration
    // - ttl: Time window in milliseconds (60000ms = 1 minute)
    // - limit: Maximum requests per IP within the time window
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 5, // 5 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 20, // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 60, // 60 requests per minute
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    AssetsModule,
    XRayModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Request ID interceptor for request correlation and logging
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    // Transform response interceptor for standardized API responses
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor,
    },
    // Apply rate limiting globally to all routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware for the application
   * RequestLoggerMiddleware logs all HTTP requests with timing and status
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
