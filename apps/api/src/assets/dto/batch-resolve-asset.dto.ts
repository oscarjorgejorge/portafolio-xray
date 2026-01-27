import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { trimUppercase } from '../../common/transforms';
import { INPUT_VALIDATION } from '../../common/constants';
import { AssetTypeDto } from './confirm-asset.dto';

/**
 * Single asset resolution request within a batch
 */
export class BatchResolveAssetItemDto {
  @ApiProperty({
    description: 'Asset identifier - can be ISIN, Morningstar ID, or ticker',
    example: 'IE00B4L5Y983',
    maxLength: INPUT_VALIDATION.MAX_INPUT_LENGTH,
  })
  @Transform(trimUppercase)
  @IsString()
  @IsNotEmpty()
  @MaxLength(INPUT_VALIDATION.MAX_INPUT_LENGTH, {
    message: `Input identifier must not exceed ${INPUT_VALIDATION.MAX_INPUT_LENGTH} characters`,
  })
  input!: string;

  @ApiPropertyOptional({
    description: 'Asset type hint to improve resolution accuracy',
    enum: AssetTypeDto,
    example: AssetTypeDto.ETF,
  })
  @IsOptional()
  @IsEnum(AssetTypeDto)
  assetType?: AssetTypeDto;
}

/**
 * Batch asset resolution request
 * Allows resolving multiple assets in a single request to reduce N+1 API calls
 */
export class BatchResolveAssetDto {
  @ApiProperty({
    description: `Array of asset identifiers to resolve (max ${INPUT_VALIDATION.MAX_BATCH_SIZE})`,
    type: [BatchResolveAssetItemDto],
    example: [
      { input: 'IE00B4L5Y983', assetType: 'ETF' },
      { input: 'LU0996182563' },
      { input: '0P0000YXJO' },
    ],
  })
  @IsArray()
  @ArrayMinSize(INPUT_VALIDATION.MIN_BATCH_SIZE)
  @ArrayMaxSize(INPUT_VALIDATION.MAX_BATCH_SIZE)
  @ValidateNested({ each: true })
  @Type(() => BatchResolveAssetItemDto)
  assets!: BatchResolveAssetItemDto[];
}
