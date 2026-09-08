import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetsRepository } from './assets.repository';
import { IsinEnrichmentService } from './isin-enrichment.service';
import { ShareClassLookupService } from './share-class-lookup.service';
import { ShareClassEnrichmentService } from './share-class-enrichment.service';

// Resolver services
import {
  MorningstarResolverService,
  ApiSearchStrategy,
  HtmlScrapeStrategy,
  GlobalSearchStrategy,
  DuckDuckGoStrategy,
  YahooFinanceSearchStrategy,
  InstantXrayScreenerStrategy,
  ResultScorerService,
  PageVerifierService,
} from './resolver';

@Module({
  controllers: [AssetsController],
  providers: [
    AssetsService,
    AssetsRepository,
    IsinEnrichmentService,
    ShareClassLookupService,
    ShareClassEnrichmentService,
    // Morningstar resolver and its dependencies
    MorningstarResolverService,
    ApiSearchStrategy,
    HtmlScrapeStrategy,
    GlobalSearchStrategy,
    DuckDuckGoStrategy,
    YahooFinanceSearchStrategy,
    InstantXrayScreenerStrategy,
    ResultScorerService,
    PageVerifierService,
  ],
  exports: [
    AssetsService,
    AssetsRepository,
    IsinEnrichmentService,
    ShareClassEnrichmentService,
  ],
})
export class AssetsModule {}
