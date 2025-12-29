import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  })
  @IsString()
  @IsNotEmpty()
  isin!: string;

  @ApiProperty({
    description: 'Morningstar unique identifier',
    example: '0P0000YXJO',
  })
  @IsString()
  @IsNotEmpty()
  morningstarId!: string;

  @ApiProperty({
    description: 'Asset name',
    example: 'iShares Core MSCI World UCITS ETF',
  })
  @IsString()
  @IsNotEmpty()
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
    example: 'https://global.morningstar.com/es/inversiones/fondos/0P0000YXJO/cotizacion',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;

  @ApiPropertyOptional({
    description: 'Asset ticker symbol',
    example: 'IWDA',
  })
  @IsString()
  @IsOptional()
  ticker?: string;
}

