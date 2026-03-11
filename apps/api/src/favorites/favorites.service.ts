import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces';
import type { PublicPortfolioListItem } from '../portfolios/portfolios.service';
import { PortfoliosService } from '../portfolios/portfolios.service';

export interface FavoriteItem {
  id: string;
  portfolioId: string;
  createdAt: Date;
  portfolio: PublicPortfolioListItem;
}

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portfoliosService: PortfoliosService,
  ) {}

  /**
   * Add a portfolio to the current user's favorites.
   * Fails if portfolio is not public or is owned by the user.
   */
  async add(
    userId: string,
    portfolioId: string,
  ): Promise<{ id: string; portfolioId: string; createdAt: Date }> {
    const portfolio = await this.portfoliosService.findPublicById(
      portfolioId,
      null,
    );
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const portfolioOwnerId = await this.getPortfolioOwnerId(portfolioId);
    if (portfolioOwnerId === userId) {
      throw new ForbiddenException(
        'You cannot add your own portfolio to favorites',
      );
    }

    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_portfolioId: { userId, portfolioId },
      },
    });
    if (existing) {
      return {
        id: existing.id,
        portfolioId: existing.portfolioId,
        createdAt: existing.createdAt,
      };
    }

    const favorite = await this.prisma.favorite.create({
      data: { userId, portfolioId },
    });
    return {
      id: favorite.id,
      portfolioId: favorite.portfolioId,
      createdAt: favorite.createdAt,
    };
  }

  /**
   * Remove a favorite. Only the owner of the favorite can remove it.
   */
  async remove(favoriteId: string, userId: string): Promise<void> {
    const favorite = await this.prisma.favorite.findFirst({
      where: { id: favoriteId, userId },
    });
    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }
    await this.prisma.favorite.delete({
      where: { id: favoriteId },
    });
  }

  /**
   * List all favorites for the current user with full portfolio data.
   * Portfolios that were deleted by owner are excluded (cascade removes the favorite).
   */
  async findAllByUser(user: AuthenticatedUser): Promise<FavoriteItem[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        portfolio: {
          include: {
            user: { select: { name: true } },
            _count: { select: { favorites: true } },
          },
        },
      },
    });

    const result: FavoriteItem[] = [];
    for (const f of favorites) {
      const portfolio = f.portfolio;
      if (!portfolio || !portfolio.isPublic) continue;
      const portfolioData = await this.portfoliosService.findPublicById(
        portfolio.id,
        user.id,
      );
      if (!portfolioData) continue;
      result.push({
        id: f.id,
        portfolioId: f.portfolioId,
        createdAt: f.createdAt,
        portfolio: {
          ...portfolioData,
          isOwnedByCurrentUser: false,
          isFavoritedByCurrentUser: true,
        },
      });
    }
    return result;
  }

  private async getPortfolioOwnerId(portfolioId: string): Promise<string> {
    const p = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: { userId: true },
    });
    if (!p) throw new NotFoundException('Portfolio not found');
    return p.userId;
  }
}
