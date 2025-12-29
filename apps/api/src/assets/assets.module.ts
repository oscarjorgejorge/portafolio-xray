import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetsRepository } from './assets.repository';
import { MorningstarResolverService } from './resolver';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, AssetsRepository, MorningstarResolverService],
  exports: [AssetsService],
})
export class AssetsModule {}
