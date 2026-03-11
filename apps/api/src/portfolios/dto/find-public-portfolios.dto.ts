import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export const PUBLIC_PORTFOLIO_SORT_VALUES = ['recent', 'favorites'] as const;
export type PublicPortfolioSort = (typeof PUBLIC_PORTFOLIO_SORT_VALUES)[number];

export class FindPublicPortfoliosDto {
  @ApiPropertyOptional({
    description:
      'Optional case-insensitive substring filter for portfolio name',
    example: 'ETF',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Optional case-insensitive substring filter for owner display name',
    example: 'Oscar',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  userName?: string;

  @ApiPropertyOptional({
    description: 'Sort order: recent (default) or by favorites count',
    enum: PUBLIC_PORTFOLIO_SORT_VALUES,
    default: 'recent',
  })
  @IsOptional()
  @IsIn(PUBLIC_PORTFOLIO_SORT_VALUES)
  sortBy?: PublicPortfolioSort;
}
