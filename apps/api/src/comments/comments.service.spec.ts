import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PortfoliosService } from '../portfolios/portfolios.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: {
    comment: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let portfoliosService: {
    findPublicById: jest.Mock;
  };

  const now = new Date('2024-01-01T00:00:00.000Z');

  beforeEach(async () => {
    prisma = {
      comment: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    portfoliosService = {
      findPublicById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PortfoliosService, useValue: portfoliosService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('listForPublicPortfolio', () => {
    it('should throw NotFoundException when portfolio does not exist', async () => {
      portfoliosService.findPublicById.mockResolvedValue(null);

      await expect(
        service.listForPublicPortfolio('portfolio-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should return comments mapped to CommentItem', async () => {
      portfoliosService.findPublicById.mockResolvedValue({ id: 'portfolio-1' });
      prisma.comment.findMany.mockResolvedValue([
        {
          id: 'comment-1',
          portfolioId: 'portfolio-1',
          content: 'Hello',
          createdAt: now,
          updatedAt: now,
          userId: 'user-1',
          user: {
            id: 'user-1',
            userName: 'tester',
            name: 'Tester',
          },
        },
      ]);

      const result = await service.listForPublicPortfolio(
        'portfolio-1',
        'user-1',
      );

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: { portfolioId: 'portfolio-1' },
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

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'comment-1',
        portfolioId: 'portfolio-1',
        content: 'Hello',
        user: {
          id: 'user-1',
          userName: 'tester',
          name: 'Tester',
        },
        isOwnedByCurrentUser: true,
      });
    });
  });

  describe('createForPublicPortfolio', () => {
    it('should throw NotFoundException when portfolio does not exist', async () => {
      portfoliosService.findPublicById.mockResolvedValue(null);

      await expect(
        service.createForPublicPortfolio('user-1', 'portfolio-1', 'Hi'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when content is empty after trim', async () => {
      portfoliosService.findPublicById.mockResolvedValue({ id: 'portfolio-1' });

      await expect(
        service.createForPublicPortfolio('user-1', 'portfolio-1', '   '),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should create comment and return mapped item', async () => {
      portfoliosService.findPublicById.mockResolvedValue({ id: 'portfolio-1' });
      prisma.comment.create.mockResolvedValue({
        id: 'comment-1',
        portfolioId: 'portfolio-1',
        content: 'Hi',
        createdAt: now,
        updatedAt: now,
        userId: 'user-1',
        user: { id: 'user-1', userName: 'tester', name: 'Tester' },
      });

      const result = await service.createForPublicPortfolio(
        'user-1',
        'portfolio-1',
        '  Hi ',
      );

      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          portfolioId: 'portfolio-1',
          content: 'Hi',
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

      expect(result.content).toBe('Hi');
      expect(result.user.id).toBe('user-1');
    });
  });

  describe('updateComment', () => {
    it('should throw NotFoundException when comment does not exist or portfolio mismatch', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.updateComment('user-1', 'portfolio-1', 'comment-1', 'New'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        portfolioId: 'portfolio-1',
        userId: 'another-user',
        content: 'Old',
        createdAt: now,
        updatedAt: now,
        user: { id: 'another-user', userName: 'other', name: 'Other' },
      });

      await expect(
        service.updateComment('user-1', 'portfolio-1', 'comment-1', 'New'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw ForbiddenException when new content is empty', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        portfolioId: 'portfolio-1',
        userId: 'user-1',
        content: 'Old',
        createdAt: now,
        updatedAt: now,
        user: { id: 'user-1', userName: 'tester', name: 'Tester' },
      });

      await expect(
        service.updateComment('user-1', 'portfolio-1', 'comment-1', '   '),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should update comment and return mapped item', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        portfolioId: 'portfolio-1',
        userId: 'user-1',
        content: 'Old',
        createdAt: now,
        updatedAt: now,
        user: { id: 'user-1', userName: 'tester', name: 'Tester' },
      });

      prisma.comment.update.mockResolvedValue({
        id: 'comment-1',
        portfolioId: 'portfolio-1',
        userId: 'user-1',
        content: 'New',
        createdAt: now,
        updatedAt: now,
        user: { id: 'user-1', userName: 'tester', name: 'Tester' },
      });

      const result = await service.updateComment(
        'user-1',
        'portfolio-1',
        'comment-1',
        ' New ',
      );

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { content: 'New' },
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

      expect(result.content).toBe('New');
      expect(result.isOwnedByCurrentUser).toBe(true);
    });
  });

  describe('deleteComment', () => {
    it('should throw NotFoundException when comment does not exist or portfolio mismatch', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteComment('user-1', 'portfolio-1', 'comment-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        portfolioId: 'portfolio-1',
        userId: 'another',
      });

      await expect(
        service.deleteComment('user-1', 'portfolio-1', 'comment-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should delete comment when user is owner', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: 'comment-1',
        portfolioId: 'portfolio-1',
        userId: 'user-1',
      });

      await service.deleteComment('user-1', 'portfolio-1', 'comment-1');

      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
      });
    });
  });
});
