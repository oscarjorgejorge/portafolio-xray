import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Global prefix for all routes
  app.setGlobalPrefix('api');

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

  console.log(`📦 Starting API server...`);
  console.log(`🔌 Port: ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(
    `💾 Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Missing'}`,
  );

  await app.listen(port);

  console.log(`🚀 API running on http://localhost:${port}/api`);
  console.log(
    `💚 Healthcheck available at http://localhost:${port}/api/health`,
  );
  console.log(`📚 Swagger docs available at http://localhost:${port}/docs`);
}

void bootstrap();
