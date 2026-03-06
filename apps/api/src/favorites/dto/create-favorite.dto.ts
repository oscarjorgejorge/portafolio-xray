import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateFavoriteDto {
  @ApiProperty({
    description: 'ID of the public portfolio to add to favorites',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  portfolioId: string;
}
