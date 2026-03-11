import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PortfoliosService, type PortfolioAsset } from './portfolios.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces';

describe('PortfoliosService', () => {
  let service: PortfoliosService;
  let prisma: {
    portfolio: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
    userName: 'testuser',
    name: 'Test User',
    avatarUrl: null,
    emailVerified: true,
    locale: 'es',
    hasPassword: true,
  };

  const basePortfolio = {
    id: 'portfolio-1',
    userId: user.id,
    name: ' My Portfolio ',
    description: '  Desc ',
    isPublic: true,
    assets: [
      { morningstarId: 'F00000WU13', weight: 60 },
      { morningstarId: 'F00000THA5', weight: 40 },
    ] as PortfolioAsset[],
    xrayShareableUrl: null,
    xrayMorningstarUrl: null,
    xrayGeneratedAt: null,
    isDeleted: false,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      portfolio: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfoliosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PortfoliosService>(PortfoliosService);
  });

  describe('create', () => {
    it('should create portfolio trimming fields and defaulting isPublic=true', async () => {
      prisma.portfolio.create.mockResolvedValue(basePortfolio);

      const result = await service.create(user.id, {
        name: ' My Portfolio ',
        description: '  Desc ',
        isPublic: undefined,
        assets: basePortfolio.assets,
      });

      expect(prisma.portfolio.create).toHaveBeenCalledWith({
        data: {
          userId: user.id,
          name: 'My Portfolio',
          description: 'Desc',
          isPublic: true,
          assets: basePortfolio.assets,
        },
      });

      expect(result).toMatchObject({
        id: basePortfolio.id,
        name: ' My Portfolio ',
        description: '  Desc ',
        isPublic: true,
        assets: basePortfolio.assets,
      });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when portfolio does not exist', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      await expect(
        service.update(user.id, 'missing', { name: 'New' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should update only provided fields and parse xrayGeneratedAt', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(basePortfolio);
      const updated = {
        ...basePortfolio,
        name: 'Updated',
        description: 'New desc',
        xrayShareableUrl: '/xray?assets=...',
        xrayMorningstarUrl: 'https://example.com',
        xrayGeneratedAt: new Date('2024-01-03T00:00:00.000Z'),
      };
      prisma.portfolio.update.mockResolvedValue(updated);

      const dto = {
        name: ' Updated ',
        description: ' New desc ',
        isPublic: false,
        assets: basePortfolio.assets,
        xrayShareableUrl: '/xray?assets=...',
        xrayMorningstarUrl: 'https://example.com',
        xrayGeneratedAt: '2024-01-03T00:00:00.000Z',
      } as any;

      const result = await service.update(user.id, basePortfolio.id, dto);

      expect(prisma.portfolio.update).toHaveBeenCalledWith({
        where: { id: basePortfolio.id },
        data: expect.objectContaining({
          name: 'Updated',
          description: 'New desc',
          isPublic: false,
          assets: basePortfolio.assets,
          xrayShareableUrl: '/xray?assets=...',
          xrayMorningstarUrl: 'https://example.com',
          xrayGeneratedAt: new Date('2024-01-03T00:00:00.000Z'),
        }),
      });

      expect(result.name).toBe('Updated');
      expect(result.description).toBe('New desc');
    });
  });

  describe('findAllByUser', () => {
    it('should return portfolios for user ordered by updatedAt desc', async () => {
      prisma.portfolio.findMany.mockResolvedValue([basePortfolio]);

      const result = await service.findAllByUser(user);

      expect(prisma.portfolio.findMany).toHaveBeenCalledWith({
        where: { userId: user.id, isDeleted: false },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(basePortfolio.id);
    });
  });

  describe('findPublic', () => {
    it('should filter by name and userName and only return valid-weight portfolios', async () => {
      const valid = {
        ...basePortfolio,
        user: { id: 'owner', name: 'Owner' },
        _count: { favorites: 2 },
        favorites: [],
      };
      const invalid = {
        ...basePortfolio,
        id: 'invalid',
        assets: [{ morningstarId: 'F1', weight: 10 }] as PortfolioAsset[],
        user: { id: 'owner', name: 'Owner' },
        _count: { favorites: 0 },
        favorites: [],
      };

      prisma.portfolio.findMany.mockResolvedValue([valid, invalid] as any);

      const result = await service.findPublic(
        { name: 'Port', userName: 'Owner', sortBy: 'favorites' },
        user.id,
      );

      expect(prisma.portfolio.findMany).toHaveBeenCalled();
      // Only valid-weight portfolio should be returned
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(basePortfolio.id);
      expect(result[0].favoritesCount).toBe(2);
    });
  });

  describe('findPublicById', () => {
    it('should return null when portfolio not found', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      const result = await service.findPublicById('missing', user.id);
      expect(result).toBeNull();
    });

    it('should return null when total weight is invalid', async () => {
      const invalid = {
        ...basePortfolio,
        assets: [{ morningstarId: 'F1', weight: 10 }],
        user: { id: 'owner', name: 'Owner' },
        _count: { favorites: 0 },
        favorites: [],
      };
      prisma.portfolio.findFirst.mockResolvedValue(invalid as any);

      const result = await service.findPublicById(basePortfolio.id, user.id);
      expect(result).toBeNull();
    });
  });

  describe('findOne', () => {
    it('should return portfolio when found for user', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(basePortfolio);

      const result = await service.findOne(basePortfolio.id, user.id);

      expect(prisma.portfolio.findFirst).toHaveBeenCalledWith({
        where: { id: basePortfolio.id, userId: user.id, isDeleted: false },
      });
      expect(result?.id).toBe(basePortfolio.id);
    });

    it('should return null when not found', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      const result = await service.findOne('missing', user.id);
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should return true when deleteMany affects rows', async () => {
      prisma.portfolio.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.remove(basePortfolio.id, user.id);

      expect(prisma.portfolio.deleteMany).toHaveBeenCalledWith({
        where: { id: basePortfolio.id, userId: user.id },
      });
      expect(result).toBe(true);
    });

    it('should return false when deleteMany does not affect rows', async () => {
      prisma.portfolio.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.remove('missing', user.id);
      expect(result).toBe(false);
    });
  });
});
