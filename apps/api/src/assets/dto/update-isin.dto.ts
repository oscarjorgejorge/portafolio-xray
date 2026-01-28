import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty } from 'class-validator';
import { trimUppercase } from '../../common/transforms';
import { IsValidIsin } from '../../common/validators';

export class UpdateIsinDto {
  @ApiProperty({
    description:
      'ISIN code (2 letter country code + 10 alphanumeric characters with valid checksum)',
    example: 'LU2485535293',
  })
  @Transform(trimUppercase)
  @IsString()
  @IsNotEmpty()
  @IsValidIsin()
  isin!: string;
}
