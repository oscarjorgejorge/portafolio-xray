import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces';
import { ApiCommonResponses } from '../common/decorators';

@ApiTags('favorites')
@Controller('favorites')
@ApiCommonResponses()
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add portfolio to favorites',
    description:
      'Add a public portfolio to the current user favorites. Cannot favorite own portfolio.',
  })
  @ApiResponse({ status: 201, description: 'Favorite added' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Cannot favorite own portfolio' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFavoriteDto,
  ) {
    return this.favoritesService.add(user.id, dto.portfolioId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove from favorites',
    description:
      'Remove a favorite by id. Only the owner of the favorite can remove it.',
  })
  @ApiResponse({ status: 204, description: 'Removed' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.favoritesService.remove(id, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List my favorites',
    description:
      'Returns all favorited public portfolios for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of favorites with portfolio data',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritesService.findAllByUser(user);
  }
}
