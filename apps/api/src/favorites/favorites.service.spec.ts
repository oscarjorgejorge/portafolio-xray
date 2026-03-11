import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';
import { PortfoliosService } from '../portfolios/portfolios.service';
import type { AuthenticatedUser } from '../auth/interfaces';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let prisma: {
    favorite: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
    };
    portfolio: {
      findUnique: jest.Mock;
    };
  };
  let portfoliosService: {
    findPublicById: jest.Mock;
  };

  const now = new Date('2024-01-01T00:00:00.000Z');

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    userName: 'tester',
    name: 'Tester',
    avatarUrl: null,
    emailVerified: true,
    locale: 'es',
    hasPassword: true,
  };

  beforeEach(async () => {
    prisma = {
      favorite: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      portfolio: {
        findUnique: jest.fn(),
      },
    };

    portfoliosService = {
      findPublicById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PortfoliosService, useValue: portfoliosService },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  describe('add', () => {
    it('should throw NotFoundException when portfolio is not public', async () => {
      portfoliosService.findPublicById.mockResolvedValue(null);

      await expect(service.add(user.id, 'portfolio-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user tries to favorite own portfolio', async () => {
      portfoliosService.findPublicById.mockResolvedValue({
        id: 'portfolio-1',
      });
      prisma.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        userId: user.id,
      });

      await expect(service.add(user.id, 'portfolio-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should return existing favorite when already created (idempotent)', async () => {
      portfoliosService.findPublicById.mockResolvedValue({
        id: 'portfolio-1',
      });
      prisma.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        userId: 'other-user',
      });
      prisma.favorite.findUnique.mockResolvedValue({
        id: 'fav-1',
        userId: user.id,
        portfolioId: 'portfolio-1',
        createdAt: now,
      });

      const result = await service.add(user.id, 'portfolio-1');

      expect(prisma.favorite.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'fav-1',
        portfolioId: 'portfolio-1',
        createdAt: now,
      });
    });

    it('should create favorite when not existing', async () => {
      portfoliosService.findPublicById.mockResolvedValue({
        id: 'portfolio-1',
      });
      prisma.portfolio.findUnique.mockResolvedValue({
        id: 'portfolio-1',
        userId: 'other-user',
      });
      prisma.favorite.findUnique.mockResolvedValue(null);
      prisma.favorite.create.mockResolvedValue({
        id: 'fav-1',
        userId: user.id,
        portfolioId: 'portfolio-1',
        createdAt: now,
      });

      const result = await service.add(user.id, 'portfolio-1');

      expect(prisma.favorite.create).toHaveBeenCalledWith({
        data: { userId: user.id, portfolioId: 'portfolio-1' },
      });
      expect(result.id).toBe('fav-1');
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException when favorite not found for user', async () => {
      prisma.favorite.findFirst.mockResolvedValue(null);

      await expect(service.remove('fav-1', user.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should delete favorite when found for user', async () => {
      prisma.favorite.findFirst.mockResolvedValue({
        id: 'fav-1',
        userId: user.id,
        portfolioId: 'portfolio-1',
      });

      await service.remove('fav-1', user.id);

      expect(prisma.favorite.delete).toHaveBeenCalledWith({
        where: { id: 'fav-1' },
      });
    });
  });

  describe('findAllByUser', () => {
    it('should return favorites with portfolio data, skipping non-public or missing portfolios', async () => {
      prisma.favorite.findMany.mockResolvedValue([
        {
          id: 'fav-1',
          userId: user.id,
          portfolioId: 'portfolio-1',
          createdAt: now,
          portfolio: {
            id: 'portfolio-1',
            isPublic: true,
            user: { name: 'Owner' },
            _count: { favorites: 2 },
          },
        },
        {
          // Non-public portfolio should be skipped
          id: 'fav-2',
          userId: user.id,
          portfolioId: 'portfolio-2',
          createdAt: now,
          portfolio: {
            id: 'portfolio-2',
            isPublic: false,
            user: { name: 'Owner 2' },
            _count: { favorites: 0 },
          },
        },
      ]);

      portfoliosService.findPublicById.mockResolvedValue({
        id: 'portfolio-1',
        name: 'Public',
        description: null,
        isPublic: true,
        assets: [],
        xrayShareableUrl: null,
        xrayMorningstarUrl: null,
        xrayGeneratedAt: null,
        createdAt: now,
        updatedAt: now,
        userName: 'Owner',
        favoritesCount: 2,
        isOwnedByCurrentUser: false,
        isFavoritedByCurrentUser: true,
      });

      const result = await service.findAllByUser(user);

      expect(prisma.favorite.findMany).toHaveBeenCalledWith({
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

      expect(result).toHaveLength(1);
      expect(result[0].portfolio.id).toBe('portfolio-1');
      expect(result[0].portfolio.isFavoritedByCurrentUser).toBe(true);
    });
  });
});
