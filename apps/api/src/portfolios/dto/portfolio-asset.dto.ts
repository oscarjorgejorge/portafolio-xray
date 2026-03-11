import {
  IsNumber,
  IsString,
  Min,
  Max,
  MaxLength,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimUppercase } from '../../common/transforms';
import { WEIGHT_VALIDATION, INPUT_VALIDATION } from '../../common/constants';

export class PortfolioAssetDto {
  @ApiProperty({
    description: 'Morningstar unique identifier',
    example: '0P0000YXJO',
    maxLength: INPUT_VALIDATION.MAX_MORNINGSTAR_ID_LENGTH,
  })
  @Transform(trimUppercase)
  @IsString()
  @IsNotEmpty()
  @MaxLength(INPUT_VALIDATION.MAX_MORNINGSTAR_ID_LENGTH, {
    message: `Morningstar ID must not exceed ${INPUT_VALIDATION.MAX_MORNINGSTAR_ID_LENGTH} characters`,
  })
  morningstarId!: string;

  @ApiProperty({
    description: `Portfolio weight as percentage (${WEIGHT_VALIDATION.MIN_WEIGHT}-${WEIGHT_VALIDATION.MAX_WEIGHT})`,
    example: 25,
    minimum: WEIGHT_VALIDATION.MIN_WEIGHT,
    maximum: WEIGHT_VALIDATION.MAX_WEIGHT,
  })
  @IsNumber()
  @Min(WEIGHT_VALIDATION.MIN_WEIGHT)
  @Max(WEIGHT_VALIDATION.MAX_WEIGHT)
  @Type(() => Number)
  weight!: number;

  @ApiPropertyOptional({
    description:
      'Original amount entered by the user (raw value, not a percentage)',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;
}
