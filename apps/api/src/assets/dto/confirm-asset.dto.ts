import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimUppercase, trimString } from '../../common/transforms';

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
  @Length(12, 12, { message: 'ISIN must be exactly 12 characters' })
  @Matches(/^[A-Z]{2}[A-Z0-9]{10}$/, {
    message:
      'ISIN must be 2 uppercase letters followed by 10 alphanumeric characters',
  })
  isin!: string;

  @ApiProperty({
    description: 'Morningstar unique identifier',
    example: '0P0000YXJO',
    maxLength: 20,
  })
  @Transform(trimUppercase)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20, {
    message: 'Morningstar ID must not exceed 20 characters',
  })
  morningstarId!: string;

  @ApiProperty({
    description: 'Asset name',
    example: 'iShares Core MSCI World UCITS ETF',
    maxLength: 255,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, { message: 'Asset name must not exceed 255 characters' })
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
    maxLength: 500,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500, { message: 'URL must not exceed 500 characters' })
  url!: string;

  @ApiPropertyOptional({
    description: 'Asset ticker symbol',
    example: 'IWDA',
    maxLength: 20,
  })
  @Transform(trimUppercase)
  @IsString()
  @IsOptional()
  @MaxLength(20, { message: 'Ticker must not exceed 20 characters' })
  ticker?: string;
}
