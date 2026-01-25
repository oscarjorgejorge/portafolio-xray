import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length } from 'class-validator';

export class UpdateIsinDto {
  @ApiProperty({
    description:
      'ISIN code (2 letter country code + 10 alphanumeric characters)',
    example: 'LU2485535293',
  })
  @IsString()
  @Length(12, 12, { message: 'ISIN must be exactly 12 characters' })
  @Matches(/^[A-Z]{2}[A-Z0-9]{10}$/, {
    message:
      'ISIN must be 2 uppercase letters followed by 10 alphanumeric characters',
  })
  isin: string;
}
