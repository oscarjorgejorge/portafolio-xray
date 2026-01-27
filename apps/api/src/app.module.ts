import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config';
import { PrismaModule } from './prisma/prisma.module';
import { AssetsModule } from './assets/assets.module';
import { XRayModule } from './xray/xray.module';
import { HealthModule } from './health/health.module';
import { HttpClientModule } from './common/http';
import { LoggerModule } from './common/logger';
import { RequestIdInterceptor } from './common/interceptors';

@Module({
  imports: [
    // Configuration module - validates env vars at startup
    ConfigModule,
    // Global logger module with request ID correlation
    LoggerModule,
    // Global HTTP client for all modules
    HttpClientModule,
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
    // Apply rate limiting globally to all routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
