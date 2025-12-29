import { Module } from '@nestjs/common';
import { XRayController } from './xray.controller';
import { XRayService } from './xray.service';

@Module({
  controllers: [XRayController],
  providers: [XRayService],
  exports: [XRayService],
})
export class XRayModule {}

