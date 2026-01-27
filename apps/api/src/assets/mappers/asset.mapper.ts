import { Asset } from '@prisma/client';
import { ResolvedAssetDto } from '../types';

/**
 * Maps a Prisma Asset entity to a ResolvedAssetDto
 * This ensures we don't expose internal database fields like createdAt/updatedAt
 * and provides a consistent API response structure.
 *
 * @param asset - The Prisma Asset entity
 * @returns A clean DTO suitable for API responses
 */
export function toResolvedAssetDto(asset: Asset): ResolvedAssetDto {
  return {
    id: asset.id,
    isin: asset.isin,
    morningstarId: asset.morningstarId,
    ticker: asset.ticker,
    name: asset.name,
    type: asset.type,
    url: asset.url,
    source: asset.source,
  };
}

/**
 * Maps an array of Prisma Asset entities to ResolvedAssetDto array
 *
 * @param assets - Array of Prisma Asset entities
 * @returns Array of clean DTOs suitable for API responses
 */
export function toResolvedAssetDtoList(assets: Asset[]): ResolvedAssetDto[] {
  return assets.map(toResolvedAssetDto);
}
