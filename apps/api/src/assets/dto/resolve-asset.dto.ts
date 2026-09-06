import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimResolveInput } from '../../common/transforms';
import { INPUT_VALIDATION } from '../../common/constants';
import { AssetTypeDto } from './confirm-asset.dto';

export class ResolveAssetDto {
  @ApiProperty({
    description:
      'Asset identifier - ISIN, Morningstar ID, ticker, or a Morningstar quote URL',
    example: 'IE00B4L5Y983',
    maxLength: INPUT_VALIDATION.MAX_RESOLVE_INPUT_LENGTH,
  })
  @Transform(trimResolveInput)
  @IsString()
  @IsNotEmpty()
  @MaxLength(INPUT_VALIDATION.MAX_RESOLVE_INPUT_LENGTH, {
    message: `Input identifier must not exceed ${INPUT_VALIDATION.MAX_RESOLVE_INPUT_LENGTH} characters`,
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
