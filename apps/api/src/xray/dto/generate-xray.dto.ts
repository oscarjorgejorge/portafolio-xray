import {
  IsArray,
  IsNumber,
  IsString,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { trimUppercase } from '../../common/transforms';
import { HasUniqueProperty, HasTotalWeight100 } from '../../common/validators';
import { WEIGHT_VALIDATION, INPUT_VALIDATION } from '../../common/constants';

export class XRayAssetDto {
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
  weight!: number;
}

export class GenerateXRayDto {
  @ApiProperty({
    description:
      'Array of portfolio assets with their weights. Total weight must equal 100%. Each morningstarId must be unique.',
    type: [XRayAssetDto],
    example: [
      { morningstarId: '0P0000YXJO', weight: 40 },
      { morningstarId: 'F00000THA5', weight: 30 },
      { morningstarId: '0P000168Z7', weight: 30 },
    ],
  })
  @IsArray()
  @ArrayMinSize(INPUT_VALIDATION.MIN_BATCH_SIZE)
  @HasUniqueProperty('morningstarId', {
    message:
      'Duplicate morningstarId found. Each asset must have a unique morningstarId.',
  })
  @HasTotalWeight100({
    message: `Total weight must equal ${WEIGHT_VALIDATION.TARGET_TOTAL}%`,
  })
  @ValidateNested({ each: true })
  @Type(() => XRayAssetDto)
  assets!: XRayAssetDto[];
}
