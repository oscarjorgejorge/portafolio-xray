import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetsRepository } from './assets.repository';
import { MorningstarResolverService } from './resolver';
import { IsinEnrichmentService } from './isin-enrichment.service';

@Module({
  controllers: [AssetsController],
  providers: [
    AssetsService,
    AssetsRepository,
    MorningstarResolverService,
    IsinEnrichmentService,
  ],
  exports: [AssetsService, AssetsRepository],
})
export class AssetsModule {}
