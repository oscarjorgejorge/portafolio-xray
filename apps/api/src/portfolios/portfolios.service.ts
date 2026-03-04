import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePortfolioDto, UpdatePortfolioDto } from './dto';
import type { AuthenticatedUser } from '../auth/interfaces';

export interface PortfolioListItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  assets: { morningstarId: string; weight: number }[];
  xrayShareableUrl: string | null;
  xrayMorningstarUrl: string | null;
  xrayGeneratedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
        assets: dto.assets as unknown as object,
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
      updateData.assets = dto.assets as unknown as Prisma.InputJsonValue;
    }

    const portfolio = await this.prisma.portfolio.update({
      where: { id: existing.id },
      data: updateData,
    });

    return this.toListItem(portfolio);
  }

  async findAllByUser(user: AuthenticatedUser): Promise<PortfolioListItem[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
    return portfolios.map((p) => this.toListItem(p));
  }

  async findOne(id: string, userId: string): Promise<PortfolioListItem | null> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, userId },
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
      assets: portfolio.assets as { morningstarId: string; weight: number }[],
      xrayShareableUrl: portfolio.xrayShareableUrl,
      xrayMorningstarUrl: portfolio.xrayMorningstarUrl,
      xrayGeneratedAt: portfolio.xrayGeneratedAt,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    };
  }
}
