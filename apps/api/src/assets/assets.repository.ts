import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Asset } from '@prisma/client';
import {
  IAssetsRepository,
  CreateAssetData,
  UpdateAssetData,
  UpsertAssetByIsinData,
  UpsertAssetByMorningstarIdData,
} from './interfaces';
import { EntityNotFoundException } from '../common/exceptions';

@Injectable()
export class AssetsRepository implements IAssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIsin(isin: string): Promise<Asset | null> {
    return this.prisma.asset.findFirst({
      where: { isin: isin.toUpperCase() },
    });
  }

  async findByMorningstarId(morningstarId: string): Promise<Asset | null> {
    return this.prisma.asset.findUnique({
      where: { morningstarId },
    });
  }

  /**
   * Find multiple assets by their Morningstar IDs in a single query
   * @param morningstarIds - Array of Morningstar IDs to look up
   * @returns Array of found assets (may be fewer than input if some don't exist)
   */
  async findManyByMorningstarIds(morningstarIds: string[]): Promise<Asset[]> {
    if (morningstarIds.length === 0) {
      return [];
    }

    return this.prisma.asset.findMany({
      where: {
        morningstarId: { in: morningstarIds },
      },
    });
  }

  /**
   * Find multiple assets by their ISINs in a single query
   * Optimizes batch lookups to avoid N+1 queries
   * @param isins - Array of ISINs to look up
   * @returns Array of found assets (may be fewer than input if some don't exist)
   */
  async findManyByIsins(isins: string[]): Promise<Asset[]> {
    if (isins.length === 0) {
      return [];
    }

    return this.prisma.asset.findMany({
      where: {
        isin: { in: isins.map((i) => i.toUpperCase()) },
      },
    });
  }

  async findById(id: string): Promise<Asset | null> {
    return this.prisma.asset.findUnique({
      where: { id },
    });
  }

  async create(data: CreateAssetData): Promise<Asset> {
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

  async update(id: string, data: UpdateAssetData): Promise<Asset> {
    return this.prisma.asset.update({
      where: { id },
      data: {
        ...(data.isin !== undefined && {
          isin: data.isin?.toUpperCase() ?? null,
        }),
        ...(data.morningstarId !== undefined && {
          morningstarId: data.morningstarId,
        }),
        ...(data.ticker !== undefined && { ticker: data.ticker }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.source !== undefined && { source: data.source }),
        ...(data.isinPending !== undefined && {
          isinPending: data.isinPending,
        }),
        ...(data.isinManual !== undefined && { isinManual: data.isinManual }),
      },
    });
  }

  /**
   * Create or update asset by ISIN using a transaction for atomicity
   * First checks if asset exists by ISIN, then by Morningstar ID
   * @param data - Asset data for upsert operation
   */
  async upsertByIsin(data: UpsertAssetByIsinData): Promise<Asset> {
    const isin = data.isin.toUpperCase();

    return this.prisma.$transaction(async (tx) => {
      // First try to find by ISIN within the transaction
      const existingByIsin = await tx.asset.findFirst({
        where: { isin },
      });

      if (existingByIsin) {
        return tx.asset.update({
          where: { id: existingByIsin.id },
          data: {
            morningstarId: data.morningstarId,
            name: data.name,
            type: data.type,
            url: data.url,
            source: data.source,
            ticker: data.ticker,
          },
        });
      }

      // If not found by ISIN, try by morningstarId (upsert)
      return tx.asset.upsert({
        where: { morningstarId: data.morningstarId },
        update: {
          isin,
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
    });
  }

  /**
   * Create or update asset by Morningstar ID (used when ISIN is not available)
   */
  async upsertByMorningstarId(
    data: UpsertAssetByMorningstarIdData,
  ): Promise<Asset> {
    return this.prisma.asset.upsert({
      where: { morningstarId: data.morningstarId },
      update: {
        isin: data.isin?.toUpperCase() ?? null,
        name: data.name,
        type: data.type,
        url: data.url,
        source: data.source,
        ticker: data.ticker,
        isinPending: data.isinPending ?? false,
      },
      create: {
        isin: data.isin?.toUpperCase() ?? null,
        morningstarId: data.morningstarId,
        name: data.name,
        type: data.type,
        url: data.url,
        source: data.source,
        ticker: data.ticker,
        isinPending: data.isinPending ?? false,
      },
    });
  }

  /**
   * Update ISIN for an asset and mark enrichment as complete
   * @param assetId - Asset UUID
   * @param isin - New ISIN value
   * @param isManual - Whether the ISIN was manually entered by user (default: false)
   */
  async updateIsin(
    assetId: string,
    isin: string,
    isManual = false,
  ): Promise<Asset> {
    return this.prisma.asset.update({
      where: { id: assetId },
      data: {
        isin: isin.toUpperCase(),
        isinPending: false,
        isinManual: isManual,
      },
    });
  }

  /**
   * Verify asset exists and update ISIN atomically using a transaction
   * This method ensures no race conditions between checking existence and updating
   * @param assetId - Asset UUID
   * @param isin - New ISIN value
   * @param isManual - Whether the ISIN was manually entered by user (default: false)
   * @returns Updated asset
   * @throws EntityNotFoundException if asset not found
   */
  async updateIsinWithVerification(
    assetId: string,
    isin: string,
    isManual = false,
  ): Promise<Asset> {
    return this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
      });

      if (!asset) {
        throw new EntityNotFoundException('Asset', assetId);
      }

      return tx.asset.update({
        where: { id: assetId },
        data: {
          isin: isin.toUpperCase(),
          isinPending: false,
          isinManual: isManual,
        },
      });
    });
  }

  /**
   * Mark ISIN enrichment as complete (even if ISIN was not found)
   */
  async markIsinEnrichmentComplete(assetId: string): Promise<Asset> {
    return this.prisma.asset.update({
      where: { id: assetId },
      data: {
        isinPending: false,
      },
    });
  }
}
