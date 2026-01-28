import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET) should return API welcome message with version', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        // The response is wrapped by the transform interceptor
        // Check if it's a wrapped response or plain text
        const body = res.body as { data?: string } | null;
        if (body && body.data) {
          expect(body.data).toMatch(/^Portfolio X-Ray API v\d+\.\d+\.\d+$/);
        } else {
          expect(res.text).toMatch(/^Portfolio X-Ray API v\d+\.\d+\.\d+$/);
        }
      });
  });
});
