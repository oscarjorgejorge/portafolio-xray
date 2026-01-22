import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Asset, AssetSource, AssetType, Prisma } from '@prisma/client';

@Injectable()
export class AssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIsin(isin: string): Promise<Asset | null> {
    return this.prisma.asset.findUnique({
      where: { isin: isin.toUpperCase() },
    });
  }

  async findByMorningstarId(morningstarId: string): Promise<Asset | null> {
    return this.prisma.asset.findUnique({
      where: { morningstarId },
    });
  }

  async findById(id: string): Promise<Asset | null> {
    return this.prisma.asset.findUnique({
      where: { id },
    });
  }

  async create(data: {
    isin: string;
    morningstarId: string;
    name: string;
    type: AssetType;
    url: string;
    source: AssetSource;
    ticker?: string;
  }): Promise<Asset> {
    return this.prisma.asset.create({
      data: {
        isin: data.isin.toUpperCase(),
        morningstarId: data.morningstarId,
        name: data.name,
        type: data.type,
        url: data.url,
        source: data.source,
        ticker: data.ticker,
      },
    });
  }

  async update(id: string, data: Prisma.AssetUpdateInput): Promise<Asset> {
    return this.prisma.asset.update({
      where: { id },
      data,
    });
  }

  async upsertByIsin(data: {
    isin: string;
    morningstarId: string;
    name: string;
    type: AssetType;
    url: string;
    source: AssetSource;
    ticker?: string;
  }): Promise<Asset> {
    const isin = data.isin.toUpperCase();
    return this.prisma.asset.upsert({
      where: { isin },
      update: {
        morningstarId: data.morningstarId,
        name: data.name,
        type: data.type,
        url: data.url,
        source: data.source,
        ticker: data.ticker,
      },
      create: {
        isin,
        morningstarId: data.morningstarId,
        name: data.name,
        type: data.type,
        url: data.url,
        source: data.source,
        ticker: data.ticker,
      },
    });
  }
}
