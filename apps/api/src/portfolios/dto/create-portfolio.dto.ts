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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HasUniqueProperty, HasTotalWeight100 } from '../../common/validators';
import {
  INPUT_VALIDATION,
  WEIGHT_VALIDATION,
  PORTFOLIO_VALIDATION,
} from '../../common/constants';
import { PortfolioAssetDto } from './portfolio-asset.dto';

export class CreatePortfolioDto {
  @ApiProperty({
    description: 'Portfolio name',
    example: 'My ETF Portfolio',
    maxLength: PORTFOLIO_VALIDATION.MAX_NAME_LENGTH,
  })
  @IsString()
  @MaxLength(PORTFOLIO_VALIDATION.MAX_NAME_LENGTH, {
    message: `Name must not exceed ${PORTFOLIO_VALIDATION.MAX_NAME_LENGTH} characters`,
  })
  name!: string;

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
  isPublic?: boolean = true;

  @ApiProperty({
    description:
      'Array of portfolio assets with weights. Total weight must equal 100%.',
    type: [PortfolioAssetDto],
  })
  @IsArray()
  @ArrayMinSize(INPUT_VALIDATION.MIN_BATCH_SIZE)
  @HasUniqueProperty('morningstarId', {
    message: 'Duplicate morningstarId found. Each asset must be unique.',
  })
  @HasTotalWeight100({
    message: `Total weight must equal ${WEIGHT_VALIDATION.TARGET_TOTAL}%`,
  })
  @ValidateNested({ each: true })
  @Type(() => PortfolioAssetDto)
  assets!: PortfolioAssetDto[];
}
