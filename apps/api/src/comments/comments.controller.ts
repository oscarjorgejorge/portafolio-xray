import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ApiCommonResponses } from '../common/decorators';
import { Public } from '../auth/decorators/public.decorator';
import { JwtOptionalGuard } from '../auth/guards/jwt-optional.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces';

@ApiTags('comments')
@ApiCommonResponses()
@Controller('portfolios/:portfolioId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @Public()
  @UseGuards(JwtOptionalGuard)
  @ApiOperation({
    summary: 'List comments for a public portfolio',
    description:
      'Returns comments for a public portfolio. Accessible without authentication. When authenticated, includes isOwnedByCurrentUser flags.',
  })
  @ApiResponse({ status: 200, description: 'List of comments' })
  async list(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser() user?: AuthenticatedUser | null,
  ) {
    return this.commentsService.listForPublicPortfolio(
      portfolioId,
      user?.id ?? null,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add comment to a public portfolio',
    description:
      'Create a new comment on a public portfolio for the current user.',
  })
  @ApiResponse({ status: 201, description: 'Comment created' })
  async create(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createForPublicPortfolio(
      user.id,
      portfolioId,
      dto.content,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update own comment',
    description:
      'Update an existing comment on a public portfolio. Only the author can update their comment.',
  })
  @ApiResponse({ status: 200, description: 'Comment updated' })
  async update(
    @Param('portfolioId') portfolioId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCommentDto,
  ) {
    const content = dto.content ?? '';
    return this.commentsService.updateComment(
      user.id,
      portfolioId,
      id,
      content,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete own comment',
    description:
      'Delete a comment on a public portfolio. Only the author can delete their comment.',
  })
  @ApiResponse({ status: 204, description: 'Comment deleted' })
  async delete(
    @Param('portfolioId') portfolioId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.commentsService.deleteComment(user.id, portfolioId, id);
  }
}
