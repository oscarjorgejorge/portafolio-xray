import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { INPUT_VALIDATION, PORTFOLIO_VALIDATION } from '../../common/constants';
import { HasUniqueProperty } from '../../common/validators';
import { PortfolioAssetDto } from './portfolio-asset.dto';

export class UpdatePortfolioDto {
  @ApiPropertyOptional({
    description: 'Portfolio name',
    example: 'My ETF Portfolio',
    maxLength: PORTFOLIO_VALIDATION.MAX_NAME_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(PORTFOLIO_VALIDATION.MAX_NAME_LENGTH, {
    message: `Name must not exceed ${PORTFOLIO_VALIDATION.MAX_NAME_LENGTH} characters`,
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Optional portfolio description',
    maxLength: PORTFOLIO_VALIDATION.MAX_DESCRIPTION_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(PORTFOLIO_VALIDATION.MAX_DESCRIPTION_LENGTH, {
    message: `Description must not exceed ${PORTFOLIO_VALIDATION.MAX_DESCRIPTION_LENGTH} characters`,
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the portfolio is public (default: true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description:
      'Array of portfolio assets with weights. Total weight is not required to be 100%.',
    type: [PortfolioAssetDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(INPUT_VALIDATION.MIN_BATCH_SIZE)
  @HasUniqueProperty('morningstarId', {
    message: 'Duplicate morningstarId found. Each asset must be unique.',
  })
  @ValidateNested({ each: true })
  @Type(() => PortfolioAssetDto)
  assets?: PortfolioAssetDto[];

  @ApiPropertyOptional({
    description: 'Shareable X-Ray URL path',
    example: '/share/abc123',
  })
  @IsOptional()
  @IsString()
  xrayShareableUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Morningstar X-Ray URL',
    example: 'https://www.morningstar.com/xray/...',
  })
  @IsOptional()
  @IsString()
  xrayMorningstarUrl?: string | null;

  @ApiPropertyOptional({
    description: 'When the X-Ray report was generated (ISO string)',
    example: '2026-03-06T10:15:00.000Z',
  })
  @IsOptional()
  @IsString()
  xrayGeneratedAt?: string | null;
}
