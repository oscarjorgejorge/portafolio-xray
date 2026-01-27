import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Asset } from '@prisma/client';

/**
 * Source of the resolved asset
 * - cache: Found in local database cache
 * - resolved: Successfully resolved from external sources
 * - manual_required: Could not resolve automatically, needs manual input
 */
export type ResolveAssetSource = 'cache' | 'resolved' | 'manual_required';

/**
 * Alternative asset suggestion when resolution needs manual review
 */
export class AssetAlternativeDto {
  @ApiProperty({
    description: 'Morningstar unique identifier',
    example: '0P0000YXJO',
  })
  morningstarId!: string;

  @ApiProperty({
    description: 'Asset name',
    example: 'iShares Core MSCI World UCITS ETF',
  })
  name!: string;

  @ApiProperty({
    description: 'Morningstar URL for this asset',
    example:
      'https://www.morningstar.es/es/etf/snapshot/snapshot.aspx?id=0P0000YXJO',
  })
  url!: string;

  @ApiProperty({
    description: 'Confidence score (0-100)',
    example: 85,
  })
  score!: number;
}

/**
 * Resolved asset details
 */
export class ResolvedAssetDto {
  @ApiProperty({
    description: 'Internal asset UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'ISIN code (may be null if pending enrichment)',
    example: 'IE00B4L5Y983',
  })
  isin?: string | null;

  @ApiProperty({
    description: 'Morningstar unique identifier',
    example: '0P0000YXJO',
  })
  morningstarId!: string;

  @ApiPropertyOptional({
    description: 'Asset ticker symbol',
    example: 'IWDA',
  })
  ticker?: string | null;

  @ApiProperty({
    description: 'Asset name',
    example: 'iShares Core MSCI World UCITS ETF',
  })
  name!: string;

  @ApiProperty({
    description: 'Asset type',
    enum: ['ETF', 'FUND', 'STOCK', 'ETC'],
    example: 'ETF',
  })
  type!: string;

  @ApiProperty({
    description: 'Morningstar URL',
    example:
      'https://www.morningstar.es/es/etf/snapshot/snapshot.aspx?id=0P0000YXJO',
  })
  url!: string;

  @ApiProperty({
    description: 'Source of asset data',
    enum: ['manual', 'web_search', 'imported'],
    example: 'web_search',
  })
  source!: string;
}

/**
 * Response DTO for asset resolution operations
 */
export class ResolveAssetResponse {
  @ApiProperty({
    description: 'Whether the resolution was successful',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Source of the resolution result',
    enum: ['cache', 'resolved', 'manual_required'],
    example: 'cache',
  })
  source!: ResolveAssetSource;

  @ApiPropertyOptional({
    description: 'The resolved asset (when successful)',
    type: ResolvedAssetDto,
  })
  asset?: Asset;

  @ApiPropertyOptional({
    description: 'Whether ISIN enrichment is pending in the background',
    example: false,
  })
  isinPending?: boolean;

  @ApiPropertyOptional({
    description: 'Alternative suggestions when manual review is needed',
    type: [AssetAlternativeDto],
  })
  alternatives?: AssetAlternativeDto[];

  @ApiPropertyOptional({
    description: 'Error message when resolution fails',
    example: 'Asset with identifier "INVALID" not found',
  })
  error?: string;
}
