import { Module } from '@nestjs/common';
import { XRayController } from './xray.controller';
import { XRayService } from './xray.service';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [AssetsModule],
  controllers: [XRayController],
  providers: [XRayService],
  exports: [XRayService],
})
export class XRayModule {}
