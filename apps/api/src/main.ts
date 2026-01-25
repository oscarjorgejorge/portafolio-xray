import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  try {
    console.log(`📦 Starting API server...`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(
      `💾 Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Missing'}`,
    );
    console.log(`🔌 PORT env var: ${process.env.PORT || 'not set'}`);
    console.log(`🔌 API_PORT env var: ${process.env.API_PORT || 'not set'}`);

    console.log(`📝 Creating NestJS application...`);
    const app = await NestFactory.create(AppModule);
    console.log(`✅ NestJS application created successfully`);

    // Enable validation pipes
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

    // Swagger configuration
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

    // CORS configuration
    app.enableCors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    });

    // Railway sets PORT automatically, fallback to API_PORT or 4000
    const port = process.env.PORT ?? process.env.API_PORT ?? 4000;

    console.log(`🔌 Port: ${port}`);

    // Listen on 0.0.0.0 to accept connections from Railway
    await app.listen(port, '0.0.0.0');

    console.log(`🚀 API running on http://localhost:${port}`);
    console.log(`💚 Healthcheck available at http://localhost:${port}/health`);
    console.log(`📚 Swagger docs available at http://localhost:${port}/docs`);
  } catch (error) {
    console.error('❌ Failed to start application:');
    if (error instanceof Error) {
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  if (reason instanceof Error) {
    console.error('Reason:', reason.message);
    console.error('Stack:', reason.stack);
  } else {
    console.error('Reason:', reason);
  }
  process.exit(1);
});

void bootstrap();
