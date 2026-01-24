import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AssetsModule } from './assets/assets.module';
import { XRayModule } from './xray/xray.module';

@Module({
  imports: [PrismaModule, AssetsModule, XRayModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
