import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePortfolioDto,
  UpdatePortfolioDto,
  FindPublicPortfoliosDto,
} from './dto';
import type { AuthenticatedUser } from '../auth/interfaces';
import { WEIGHT_VALIDATION } from '../common/constants';

export interface PortfolioAsset {
  morningstarId: string;
  weight: number;
  amount?: number;
}

export interface PortfolioListItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  assets: PortfolioAsset[];
  xrayShareableUrl: string | null;
  xrayMorningstarUrl: string | null;
  xrayGeneratedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicPortfolioListItem extends PortfolioListItem {
  userName: string;
  favoritesCount: number;
  isOwnedByCurrentUser?: boolean;
  isFavoritedByCurrentUser?: boolean;
  /** When isFavoritedByCurrentUser is true, the id of the Favorite record for DELETE */
  favoriteId?: string;
}

@Injectable()
export class PortfoliosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreatePortfolioDto,
  ): Promise<PortfolioListItem> {
    const portfolio = await this.prisma.portfolio.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        isPublic: dto.isPublic ?? true,
        assets: this.toPortfolioAssetsJson(dto.assets),
      },
    });
    return this.toListItem(portfolio);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdatePortfolioDto,
  ): Promise<PortfolioListItem> {
    const existing = await this.prisma.portfolio.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Portfolio not found');
    }

    const updateData: Prisma.PortfolioUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description?.trim() || null;
    }

    if (dto.isPublic !== undefined) {
      updateData.isPublic = dto.isPublic;
    }

    if (dto.assets !== undefined) {
      updateData.assets = this.toPortfolioAssetsJson(dto.assets);
    }

    if (dto.xrayShareableUrl !== undefined) {
      updateData.xrayShareableUrl = dto.xrayShareableUrl;
    }

    if (dto.xrayMorningstarUrl !== undefined) {
      updateData.xrayMorningstarUrl = dto.xrayMorningstarUrl;
    }

    if (dto.xrayGeneratedAt !== undefined) {
      updateData.xrayGeneratedAt = dto.xrayGeneratedAt
        ? new Date(dto.xrayGeneratedAt)
        : null;
    }

    const portfolio = await this.prisma.portfolio.update({
      where: { id: existing.id },
      data: updateData,
    });

    return this.toListItem(portfolio);
  }

  async findAllByUser(user: AuthenticatedUser): Promise<PortfolioListItem[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId: user.id, isDeleted: false },
      orderBy: { updatedAt: 'desc' },
    });
    return portfolios.map((p) => this.toListItem(p));
  }

  async findPublic(
    filters: FindPublicPortfoliosDto,
    currentUserId?: string | null,
  ): Promise<PublicPortfolioListItem[]> {
    const { name, userName, sortBy = 'recent' } = filters;

    // Base user filter: only non-deleted users
    const userWhere: Prisma.UserWhereInput = {
      isDeleted: false,
    };

    if (userName) {
      userWhere.name = {
        contains: userName,
        mode: 'insensitive',
      };
    }

    const where: Prisma.PortfolioWhereInput = {
      isPublic: true,
      isDeleted: false,
      user: { is: userWhere },
    };

    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      };
    }

    const orderBy: Prisma.PortfolioOrderByWithRelationInput[] =
      sortBy === 'favorites'
        ? [{ favorites: { _count: 'desc' } }, { updatedAt: 'desc' }]
        : [{ updatedAt: 'desc' }];

    const portfolios = await this.prisma.portfolio.findMany({
      where,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { favorites: true },
        },
        favorites:
          currentUserId != null
            ? {
                where: { userId: currentUserId },
                select: { id: true },
                take: 1,
              }
            : false,
      },
    });

    const validPortfolios = portfolios.filter((portfolio) =>
      this.isTotalWeightValid(
        portfolio.assets as { morningstarId: string; weight: number }[],
      ),
    );

    return validPortfolios.map((portfolio) => {
      const row = portfolio as typeof portfolio & {
        _count: { favorites: number };
        favorites?: { id: string }[];
      };
      return {
        ...this.toListItem(portfolio),
        userName: portfolio.user.name,
        favoritesCount: row._count?.favorites ?? 0,
        isOwnedByCurrentUser:
          currentUserId != null
            ? portfolio.user.id === currentUserId
            : undefined,
        isFavoritedByCurrentUser:
          currentUserId != null && Array.isArray(row.favorites)
            ? row.favorites.length > 0
            : undefined,
        favoriteId:
          currentUserId != null &&
          Array.isArray(row.favorites) &&
          row.favorites.length > 0
            ? row.favorites[0].id
            : undefined,
      };
    });
  }

  async findPublicById(
    id: string,
    currentUserId?: string | null,
  ): Promise<PublicPortfolioListItem | null> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: {
        id,
        isPublic: true,
        isDeleted: false,
        user: {
          is: {
            isDeleted: false,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { favorites: true },
        },
        favorites:
          currentUserId != null
            ? {
                where: { userId: currentUserId },
                select: { id: true },
              }
            : false,
      },
    });

    if (!portfolio) {
      return null;
    }

    const assets = portfolio.assets as {
      morningstarId: string;
      weight: number;
    }[];

    if (!this.isTotalWeightValid(assets)) {
      return null;
    }

    const row = portfolio as typeof portfolio & {
      _count: { favorites: number };
      favorites?: { id: string }[];
    };

    return {
      ...this.toListItem(portfolio),
      userName: portfolio.user.name,
      favoritesCount: row._count?.favorites ?? 0,
      isOwnedByCurrentUser:
        currentUserId != null ? portfolio.user.id === currentUserId : undefined,
      isFavoritedByCurrentUser:
        currentUserId != null && Array.isArray(row.favorites)
          ? row.favorites.length > 0
          : undefined,
      favoriteId:
        currentUserId != null &&
        Array.isArray(row.favorites) &&
        row.favorites.length > 0
          ? row.favorites[0].id
          : undefined,
    };
  }

  async findOne(id: string, userId: string): Promise<PortfolioListItem | null> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, userId, isDeleted: false },
    });
    return portfolio ? this.toListItem(portfolio) : null;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.portfolio.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  private toListItem(portfolio: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    assets: unknown;
    xrayShareableUrl: string | null;
    xrayMorningstarUrl: string | null;
    xrayGeneratedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PortfolioListItem {
    return {
      id: portfolio.id,
      name: portfolio.name,
      description: portfolio.description,
      isPublic: portfolio.isPublic,
      assets: portfolio.assets as PortfolioAsset[],
      xrayShareableUrl: portfolio.xrayShareableUrl,
      xrayMorningstarUrl: portfolio.xrayMorningstarUrl,
      xrayGeneratedAt: portfolio.xrayGeneratedAt,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    };
  }

  private toPortfolioAssetsJson(
    assets: PortfolioAsset[],
  ): Prisma.InputJsonValue {
    return assets as unknown as Prisma.InputJsonValue;
  }

  private isTotalWeightValid(assets: PortfolioAsset[]): boolean {
    if (!assets.length) {
      return false;
    }

    const totalWeight = assets.reduce(
      (sum, asset) => sum + (asset.weight || 0),
      0,
    );

    return (
      Math.abs(totalWeight - WEIGHT_VALIDATION.TARGET_TOTAL) <=
      WEIGHT_VALIDATION.TOLERANCE
    );
  }
}
