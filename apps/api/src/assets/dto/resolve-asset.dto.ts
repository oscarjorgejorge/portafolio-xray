import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimUppercase } from '../../common/transforms';
import { AssetTypeDto } from './confirm-asset.dto';

export class ResolveAssetDto {
  @ApiProperty({
    description: 'Asset identifier - can be ISIN, Morningstar ID, or ticker',
    example: 'IE00B4L5Y983',
  })
  @Transform(trimUppercase)
  @IsString()
  @IsNotEmpty()
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
