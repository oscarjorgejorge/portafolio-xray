import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';
import { trimUppercase } from '../../common/transforms';

export class UpdateTickerDto {
  @ApiProperty({
    description: 'Stock ticker symbol (1-10 uppercase alphanumeric characters)',
    example: 'AAPL',
  })
  @Transform(trimUppercase)
  @IsString()
  @IsNotEmpty({ message: 'Ticker is required' })
  @MaxLength(10, { message: 'Ticker must be at most 10 characters' })
  @Matches(/^[A-Z0-9.]+$/, {
    message: 'Ticker must contain only uppercase letters, numbers, and dots',
  })
  ticker!: string;
}
