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
import { AssetTypeDto } from './confirm-asset.dto';

/**
 * Single asset resolution request within a batch
 */
export class BatchResolveAssetItemDto {
  @ApiProperty({
    description: 'Asset identifier - can be ISIN, Morningstar ID, or ticker',
    example: 'IE00B4L5Y983',
    maxLength: 50,
  })
  @Transform(trimUppercase)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50, { message: 'Input identifier must not exceed 50 characters' })
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
    description: 'Array of asset identifiers to resolve (max 20)',
    type: [BatchResolveAssetItemDto],
    example: [
      { input: 'IE00B4L5Y983', assetType: 'ETF' },
      { input: 'LU0996182563' },
      { input: '0P0000YXJO' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BatchResolveAssetItemDto)
  assets!: BatchResolveAssetItemDto[];
}
