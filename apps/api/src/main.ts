import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ThrottlerExceptionFilter } from './common/filters';
import type { AppConfig } from './config';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  try {
    logger.log('Starting API server...');

    // Create the application - ConfigModule validates env vars here
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    // Get validated configuration with type-safe access
    const configService = app.get(ConfigService<AppConfig, true>);
    const nodeEnv = configService.get('nodeEnv', { infer: true });
    const port = configService.get('port', { infer: true });
    const corsOrigins = configService.get('corsOrigins', { infer: true });
    const isProduction = configService.get('isProduction', { infer: true });

    logger.log(`Environment: ${nodeEnv}`);
    logger.log(`Port: ${port}`);
    logger.log(`Production mode: ${isProduction}`);

    // Security: Helmet middleware for HTTP headers
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );
    logger.log('Helmet security middleware enabled');

    // Validation pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Global exception filters
    app.useGlobalFilters(new ThrottlerExceptionFilter());
    logger.log('Rate limiting enabled (5/s, 20/10s, 60/min per IP)');

    // Swagger configuration (only in non-production or if explicitly enabled)
    if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
      const config = new DocumentBuilder()
        .setTitle('Portfolio X-Ray API')
        .setDescription(
          'API for generating Morningstar X-Ray reports. Resolves ISINs to Morningstar IDs and generates portfolio analysis URLs.',
        )
        .setVersion('1.0')
        .addTag('assets', 'Asset resolution and cache management')
        .addTag('xray', 'X-Ray URL generation')
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('docs', app, document);
      logger.log('Swagger documentation enabled at /docs');
    }

    // CORS configuration using validated config
    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
          callback(null, true);
          return;
        }

        // Check if origin is in the allowed list
        if (corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        // Allow Vercel preview deployments (*.vercel.app)
        if (origin.endsWith('.vercel.app')) {
          callback(null, true);
          return;
        }

        // Reject other origins
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
    });

    // Listen on 0.0.0.0 to accept connections from containers/cloud platforms
    await app.listen(port, '0.0.0.0');

    logger.log(`API running on http://localhost:${port}`);
    logger.log(`Healthcheck available at http://localhost:${port}/health`);

    if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
      logger.log(`Swagger docs available at http://localhost:${port}/docs`);
    }
  } catch (error) {
    logger.error('Failed to start application');

    if (error instanceof Error) {
      logger.error(`Error type: ${error.constructor.name}`);
      logger.error(`Error message: ${error.message}`);

      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
    } else {
      logger.error(`Unknown error: ${String(error)}`);
    }

    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection');

  if (reason instanceof Error) {
    logger.error(`Reason: ${reason.message}`);
    if (reason.stack) {
      logger.error(`Stack: ${reason.stack}`);
    }
  } else {
    logger.error(`Reason: ${String(reason)}`);
  }

  process.exit(1);
});

void bootstrap();
