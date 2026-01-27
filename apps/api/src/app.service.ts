import { Injectable } from '@nestjs/common';

const APP_VERSION = process.env.npm_package_version || '1.0.0';

@Injectable()
export class AppService {
  getHello(): string {
    return `Portfolio X-Ray API v${APP_VERSION}`;
  }
}
