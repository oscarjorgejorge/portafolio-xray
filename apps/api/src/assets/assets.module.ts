import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetsRepository } from './assets.repository';
import { IsinEnrichmentService } from './isin-enrichment.service';

// Resolver services
import {
  MorningstarResolverService,
  ApiSearchStrategy,
  HtmlScrapeStrategy,
  GlobalSearchStrategy,
  DuckDuckGoStrategy,
  ResultScorerService,
  PageVerifierService,
} from './resolver';

@Module({
  controllers: [AssetsController],
  providers: [
    AssetsService,
    AssetsRepository,
    IsinEnrichmentService,
    // Morningstar resolver and its dependencies
    MorningstarResolverService,
    ApiSearchStrategy,
    HtmlScrapeStrategy,
    GlobalSearchStrategy,
    DuckDuckGoStrategy,
    ResultScorerService,
    PageVerifierService,
  ],
  exports: [AssetsService, AssetsRepository],
})
export class AssetsModule {}
