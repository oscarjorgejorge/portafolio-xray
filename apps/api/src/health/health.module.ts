import { Module, forwardRef } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [forwardRef(() => AssetsModule)],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
