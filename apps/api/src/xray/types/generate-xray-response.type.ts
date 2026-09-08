import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for X-Ray URL generation
 */
export class GenerateXRayResponse {
  @ApiProperty({
    description: 'Direct URL to Morningstar X-Ray PDF report',
    example:
      'https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx?LanguageId=es-ES&PortfolioType=2&SecurityTokenList=...',
  })
  morningstarUrl!: string;

  @ApiProperty({
    description: 'Shareable app URL with portfolio encoded in query params',
    example: '/xray?assets=0P0000YXJO:40,F00000THA5:30,0P000168Z7:30',
  })
  shareableUrl!: string;

  @ApiProperty({
    description:
      'Number of fund/ETF/ETC holdings that still use a 0P performance ID because the Instant X-Ray F ID is not in cache yet',
    example: 0,
  })
  holdingsUsingFallback!: number;
}
