import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLocaleDto {
  @ApiProperty({
    description: 'User language preference',
    enum: ['es', 'en'],
    example: 'es',
  })
  @IsString()
  @IsIn(['es', 'en'], { message: 'Locale must be either "es" or "en"' })
  locale: 'es' | 'en';
}
