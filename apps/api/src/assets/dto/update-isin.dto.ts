import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, Length } from 'class-validator';
import { trimUppercase } from '../../common/transforms';

export class UpdateIsinDto {
  @ApiProperty({
    description:
      'ISIN code (2 letter country code + 10 alphanumeric characters)',
    example: 'LU2485535293',
  })
  @Transform(trimUppercase)
  @IsString()
  @Length(12, 12, { message: 'ISIN must be exactly 12 characters' })
  @Matches(/^[A-Z]{2}[A-Z0-9]{10}$/, {
    message:
      'ISIN must be 2 uppercase letters followed by 10 alphanumeric characters',
  })
  isin: string;
}
