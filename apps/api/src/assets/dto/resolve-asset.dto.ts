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
import { INPUT_VALIDATION } from '../../common/constants';
import { AssetTypeDto } from './confirm-asset.dto';

export class ResolveAssetDto {
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
