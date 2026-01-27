import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimUppercase } from '../../common/transforms';
import { AssetTypeDto } from './confirm-asset.dto';

export class ResolveAssetDto {
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
