import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimUppercase, trimString } from '../../common/transforms';
import { IsValidIsin } from '../../common/validators';
import { INPUT_VALIDATION } from '../../common/constants';

export enum AssetTypeDto {
  ETF = 'ETF',
  FUND = 'FUND',
  STOCK = 'STOCK',
  ETC = 'ETC',
}

export class ConfirmAssetDto {
  @ApiProperty({
    description: 'International Securities Identification Number',
    example: 'IE00B4L5Y983',
    minLength: 12,
    maxLength: 12,
  })
  @Transform(trimUppercase)
  @IsString()
  @IsNotEmpty()
  @IsValidIsin()
  isin!: string;

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
    description: 'Asset name',
    example: 'iShares Core MSCI World UCITS ETF',
    maxLength: INPUT_VALIDATION.MAX_ASSET_NAME_LENGTH,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(INPUT_VALIDATION.MAX_ASSET_NAME_LENGTH, {
    message: `Asset name must not exceed ${INPUT_VALIDATION.MAX_ASSET_NAME_LENGTH} characters`,
  })
  name!: string;

  @ApiProperty({
    description: 'Type of asset',
    enum: AssetTypeDto,
    example: AssetTypeDto.ETF,
  })
  @IsEnum(AssetTypeDto)
  type!: AssetTypeDto;

  @ApiProperty({
    description: 'Morningstar URL for the asset',
    example:
      'https://global.morningstar.com/es/inversiones/fondos/0P0000YXJO/cotizacion',
    maxLength: INPUT_VALIDATION.MAX_URL_LENGTH,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(INPUT_VALIDATION.MAX_URL_LENGTH, {
    message: `URL must not exceed ${INPUT_VALIDATION.MAX_URL_LENGTH} characters`,
  })
  url!: string;

  @ApiPropertyOptional({
    description: 'Asset ticker symbol',
    example: 'IWDA',
    maxLength: INPUT_VALIDATION.MAX_TICKER_LENGTH,
  })
  @Transform(trimUppercase)
  @IsString()
  @IsOptional()
  @MaxLength(INPUT_VALIDATION.MAX_TICKER_LENGTH, {
    message: `Ticker must not exceed ${INPUT_VALIDATION.MAX_TICKER_LENGTH} characters`,
  })
  ticker?: string;
}
