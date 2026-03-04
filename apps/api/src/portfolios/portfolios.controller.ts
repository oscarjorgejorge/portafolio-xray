import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PortfoliosService } from './portfolios.service';
import { CreatePortfolioDto, UpdatePortfolioDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces';
import { ApiCommonResponses } from '../common/decorators';

@ApiTags('portfolios')
@Controller('portfolios')
@ApiCommonResponses()
@UseGuards(JwtAuthGuard)
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a portfolio',
    description: 'Save a new portfolio for the current user.',
  })
  @ApiResponse({ status: 201, description: 'Portfolio created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfoliosService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List my portfolios',
    description: 'Returns all portfolios for the current user.',
  })
  @ApiResponse({ status: 200, description: 'List of portfolios' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.portfoliosService.findAllByUser(user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a portfolio',
    description:
      'Update an existing portfolio for the current user. Only provided fields will be changed.',
  })
  @ApiResponse({ status: 200, description: 'Portfolio updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioDto,
  ) {
    return this.portfoliosService.update(user.id, id, dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one portfolio',
    description: 'Returns a single portfolio by id if it belongs to the user.',
  })
  @ApiResponse({ status: 200, description: 'Portfolio' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.portfoliosService.findOne(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a portfolio',
    description: 'Deletes a portfolio if it belongs to the current user.',
  })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const removed = await this.portfoliosService.remove(id, user.id);
    if (!removed) {
      throw new NotFoundException('Portfolio not found');
    }
  }
}
