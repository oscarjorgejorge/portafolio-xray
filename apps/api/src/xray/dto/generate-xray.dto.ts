import {
  IsArray,
  IsNumber,
  IsString,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class XRayAssetDto {
  @ApiProperty({
    description: 'Morningstar unique identifier',
    example: '0P0000YXJO',
  })
  @IsString()
  morningstarId!: string;

  @ApiProperty({
    description: 'Portfolio weight as percentage (0-100)',
    example: 25,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  weight!: number;
}

export class GenerateXRayDto {
  @ApiProperty({
    description:
      'Array of portfolio assets with their weights. Total weight must equal 100%.',
    type: [XRayAssetDto],
    example: [
      { morningstarId: '0P0000YXJO', weight: 40 },
      { morningstarId: 'F00000THA5', weight: 30 },
      { morningstarId: '0P000168Z7', weight: 30 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => XRayAssetDto)
  assets!: XRayAssetDto[];
}
