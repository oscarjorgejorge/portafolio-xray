import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Asset, Prisma } from '@prisma/client';
import {
  IAssetsRepository,
  CreateAssetData,
  UpdateAssetData,
  UpsertAssetByIsinData,
  UpsertAssetByMorningstarIdData,
} from './interfaces';
import { EntityNotFoundException } from '../common/exceptions';
import { pickPreferredFundAsset } from './resolver/utils/canonical-fund-id';
import { isPersistedMorningstarIdValid } from './resolver/utils/id-extractor';

@Injectable()
export class AssetsRepository implements IAssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByIsin(isin: string): Promise<Asset | null> {
    const matches = await this.prisma.asset.findMany({
      where: { isin: isin.toUpperCase() },
    });
    return pickPreferredFundAsset(matches);
  }

  async findByMorningstarId(morningstarId: string): Promise<Asset | null> {
    const byQuoteId = await this.prisma.asset.findUnique({
      where: { morningstarId },
    });
    if (byQuoteId) {
      return byQuoteId;
    }
    return this.findByShareClassId(morningstarId);
  }

  async findByShareClassId(shareClassId: string): Promise<Asset | null> {
    return this.prisma.asset.findUnique({
      where: { shareClassId },
    });
  }

  /**
   * Find multiple assets by quote IDs or Instant X-Ray share-class IDs
   * @param morningstarIds - Array of Morningstar IDs to look up
   * @returns Array of found assets (may be fewer than input if some don't exist)
   */
  async findManyByMorningstarIds(morningstarIds: string[]): Promise<Asset[]> {
    if (morningstarIds.length === 0) {
      return [];
    }

    return this.prisma.asset.findMany({
      where: {
        OR: [
          { morningstarId: { in: morningstarIds } },
          { shareClassId: { in: morningstarIds } },
        ],
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
        shareClassId: data.shareClassId ?? null,
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
        ...(data.shareClassId !== undefined && {
          shareClassId: data.shareClassId,
        }),
        ...(data.shareClassVerified !== undefined && {
          shareClassVerified: data.shareClassVerified,
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
        ...(data.tickerManual !== undefined && {
          tickerManual: data.tickerManual,
        }),
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
      const matches = await tx.asset.findMany({
        where: { isin },
      });
      const existingByIsin = pickPreferredFundAsset(matches);

      if (existingByIsin) {
        return tx.asset.update({
          where: { id: existingByIsin.id },
          data: {
            morningstarId: data.morningstarId,
            ...(data.shareClassId !== undefined && {
              shareClassId: data.shareClassId,
            }),
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
          ...(data.shareClassId !== undefined && {
            shareClassId: data.shareClassId,
          }),
          name: data.name,
          type: data.type,
          url: data.url,
          source: data.source,
          ticker: data.ticker,
        },
        create: {
          isin,
          morningstarId: data.morningstarId,
          shareClassId: data.shareClassId ?? null,
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
   * Note: Only updates ticker if explicitly provided (not undefined)
   * This prevents overwriting existing ticker data during manual confirmation
   */
  async upsertByMorningstarId(
    data: UpsertAssetByMorningstarIdData,
  ): Promise<Asset> {
    return this.prisma.$transaction(async (tx) => {
      const existingByQuoteId = await tx.asset.findUnique({
        where: { morningstarId: data.morningstarId },
      });
      let existing = existingByQuoteId;

      if (!existing && data.shareClassId) {
        existing = await tx.asset.findUnique({
          where: { shareClassId: data.shareClassId },
        });
      }

      if (!existing && data.isin) {
        const siblings = await tx.asset.findMany({
          where: { isin: data.isin.toUpperCase() },
        });
        existing =
          siblings.find(
            (row) => !isPersistedMorningstarIdValid(row.morningstarId),
          ) ?? null;
      }

      const shareClassId = await this.shareClassIdForWrite(
        tx,
        data.shareClassId,
        existing?.id,
      );

      const updateData = {
        ...(data.isin
          ? {
              isin: data.isin.toUpperCase(),
              isinPending: false,
            }
          : {
              isinPending: data.isinPending ?? false,
            }),
        ...(shareClassId !== undefined && { shareClassId }),
        name: data.name,
        type: data.type,
        url: data.url,
        source: data.source,
        ...(data.ticker !== undefined && { ticker: data.ticker }),
      };

      if (existing) {
        if (
          existing.morningstarId !== data.morningstarId &&
          !existingByQuoteId
        ) {
          const taken = await tx.asset.findUnique({
            where: { morningstarId: data.morningstarId },
          });
          if (!taken) {
            Object.assign(updateData, { morningstarId: data.morningstarId });
          } else {
            existing = taken;
          }
        }

        return tx.asset.update({
          where: { id: existing.id },
          data: updateData,
        });
      }

      return tx.asset.create({
        data: {
          isin: data.isin?.toUpperCase() ?? null,
          morningstarId: data.morningstarId,
          shareClassId: shareClassId ?? null,
          name: data.name,
          type: data.type,
          url: data.url,
          source: data.source,
          ticker: data.ticker ?? null,
          isinPending: data.isinPending ?? false,
        },
      });
    });
  }

  /**
   * Keep shareClassId unique: skip writing an F ID already owned by another row
   */
  private async shareClassIdForWrite(
    tx: Prisma.TransactionClient,
    shareClassId: string | null | undefined,
    currentAssetId?: string,
  ): Promise<string | null | undefined> {
    if (shareClassId === undefined) {
      return undefined;
    }
    if (!shareClassId) {
      return null;
    }

    const holder = await tx.asset.findUnique({
      where: { shareClassId },
    });
    if (!holder || holder.id === currentAssetId) {
      return shareClassId;
    }
    return undefined;
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

  async tryAssignShareClassId(
    assetId: string,
    shareClassId: string,
    options?: { verified?: boolean },
  ): Promise<Asset | null> {
    const shareClassVerified = options?.verified ?? true;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.asset.findUnique({
          where: { id: assetId },
        });
        if (!current) {
          return null;
        }

        const holder = await tx.asset.findUnique({
          where: { shareClassId },
        });
        if (holder && holder.id !== assetId) {
          const sameIsin =
            Boolean(current.isin) && current.isin === holder.isin;
          const holderIsCanonicalFRow = holder.morningstarId === shareClassId;
          if (!sameIsin && !holderIsCanonicalFRow) {
            return null;
          }
          await tx.asset.update({
            where: { id: holder.id },
            data: { shareClassId: null, shareClassVerified: false },
          });
        }

        return tx.asset.update({
          where: { id: assetId },
          data: { shareClassId, shareClassVerified },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Verify asset exists and update ticker atomically using a transaction
   * This method ensures no race conditions between checking existence and updating
   * @param assetId - Asset UUID
   * @param ticker - New ticker value
   * @param isManual - Whether the ticker was manually entered by user (default: false)
   * @returns Updated asset
   * @throws EntityNotFoundException if asset not found
   */
  async updateTickerWithVerification(
    assetId: string,
    ticker: string,
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
          ticker: ticker.toUpperCase(),
          tickerManual: isManual,
        },
      });
    });
  }
}
