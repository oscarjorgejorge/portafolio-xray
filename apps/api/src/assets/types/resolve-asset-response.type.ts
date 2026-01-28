import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Source/status of the resolved asset
 * Used as an enum for better type safety and IDE support
 */
export enum ResolutionSource {
  /** Found in local database cache */
  CACHE = 'cache',
  /** Successfully resolved from external sources */
  RESOLVED = 'resolved',
  /** Could not resolve automatically, needs manual input */
  MANUAL_REQUIRED = 'manual_required',
}

/**
 * Error codes for asset resolution failures
 * Helps clients categorize and handle errors appropriately
 */
export enum ResolutionErrorCode {
  /** Asset not found in any source */
  NOT_FOUND = 'NOT_FOUND',
  /** Multiple matches found, needs manual selection */
  AMBIGUOUS_MATCH = 'AMBIGUOUS_MATCH',
  /** Network error during external resolution */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Request timed out */
  TIMEOUT = 'TIMEOUT',
  /** External service temporarily unavailable (circuit open) */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  /** Unknown or unexpected error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * @deprecated Use ResolutionSource enum instead
 */
export type ResolveAssetSource = `${ResolutionSource}`;

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

  @ApiPropertyOptional({
    description: 'Asset ticker symbol (if available)',
    example: 'OPTT',
  })
  ticker?: string;
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

  @ApiPropertyOptional({
    description: 'Whether ISIN enrichment is pending in the background',
    example: false,
  })
  isinPending?: boolean;

  @ApiPropertyOptional({
    description: 'Whether ISIN was manually entered by user',
    example: false,
  })
  isinManual?: boolean;

  @ApiPropertyOptional({
    description: 'Whether ticker was manually entered by user',
    example: false,
  })
  tickerManual?: boolean;
}

/**
 * Response DTO for asset resolution operations
 *
 * Response patterns:
 * - success=true, source=CACHE|RESOLVED: Asset found, check `asset` field
 * - success=false, source=MANUAL_REQUIRED: Resolution failed, check `error` and `alternatives`
 */
export class ResolveAssetResponse {
  @ApiProperty({
    description: 'Whether the resolution was successful',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Source of the resolution result',
    enum: ResolutionSource,
    enumName: 'ResolutionSource',
    example: ResolutionSource.CACHE,
  })
  source!: ResolutionSource;

  @ApiPropertyOptional({
    description: 'The resolved asset (when successful)',
    type: ResolvedAssetDto,
  })
  asset?: ResolvedAssetDto;

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
    description: 'Error code for categorizing the failure type',
    enum: ResolutionErrorCode,
    enumName: 'ResolutionErrorCode',
    example: ResolutionErrorCode.NOT_FOUND,
  })
  errorCode?: ResolutionErrorCode;

  @ApiPropertyOptional({
    description: 'Human-readable error message when resolution fails',
    example: 'Asset with identifier "INVALID" not found',
  })
  error?: string;
}
