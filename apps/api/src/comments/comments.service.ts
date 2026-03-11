import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfoliosService } from '../portfolios/portfolios.service';

export interface CommentUserSummary {
  id: string;
  userName: string;
  name: string;
}

export interface CommentItem {
  id: string;
  portfolioId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user: CommentUserSummary;
  isOwnedByCurrentUser?: boolean;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portfoliosService: PortfoliosService,
  ) {}

  private validateAndNormalizeContent(content: string): string {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new ForbiddenException('Comment content cannot be empty');
    }
    return trimmed;
  }

  private toCommentItem(
    comment: {
      id: string;
      portfolioId: string;
      content: string;
      createdAt: Date;
      updatedAt: Date;
      user: { id: string; userName: string; name: string };
    },
    currentUserId?: string | null,
  ): CommentItem {
    return {
      id: comment.id,
      portfolioId: comment.portfolioId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: {
        id: comment.user.id,
        userName: comment.user.userName,
        name: comment.user.name,
      },
      isOwnedByCurrentUser:
        currentUserId != null ? comment.user.id === currentUserId : undefined,
    };
  }

  async listForPublicPortfolio(
    portfolioId: string,
    currentUserId?: string | null,
  ): Promise<CommentItem[]> {
    const portfolio = await this.portfoliosService.findPublicById(
      portfolioId,
      currentUserId ?? null,
    );

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const comments = await this.prisma.comment.findMany({
      where: { portfolioId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            name: true,
          },
        },
      },
    });

    return comments.map((comment) =>
      this.toCommentItem(comment, currentUserId),
    );
  }

  async createForPublicPortfolio(
    userId: string,
    portfolioId: string,
    content: string,
  ): Promise<CommentItem> {
    const portfolio = await this.portfoliosService.findPublicById(
      portfolioId,
      userId,
    );

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const trimmed = this.validateAndNormalizeContent(content);

    const comment = await this.prisma.comment.create({
      data: {
        userId,
        portfolioId,
        content: trimmed,
      },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            name: true,
          },
        },
      },
    });

    return this.toCommentItem(comment, userId);
  }

  async updateComment(
    userId: string,
    portfolioId: string,
    commentId: string,
    content: string,
  ): Promise<CommentItem> {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            name: true,
          },
        },
      },
    });

    if (!existing || existing.portfolioId !== portfolioId) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    const trimmed = this.validateAndNormalizeContent(content);

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: trimmed },
      include: {
        user: {
          select: {
            id: true,
            userName: true,
            name: true,
          },
        },
      },
    });

    return this.toCommentItem(updated, userId);
  }

  async deleteComment(
    userId: string,
    portfolioId: string,
    commentId: string,
  ): Promise<void> {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!existing || existing.portfolioId !== portfolioId) {
      throw new NotFoundException('Comment not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });
  }
}
