import { Module, forwardRef } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { AssetsModule } from '../assets/assets.module';
import { HttpClientModule } from '../common/http';

@Module({
  imports: [forwardRef(() => AssetsModule), HttpClientModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
