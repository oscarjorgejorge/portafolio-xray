import { Asset } from '@prisma/client';
import { ResolveAssetDto, ConfirmAssetDto } from '../dto';

/**
 * Response structure for asset resolution
 */
export interface ResolveAssetResponse {
  success: boolean;
  source: 'cache' | 'resolved' | 'manual_required';
  asset?: Asset;
  isinPending?: boolean;
  alternatives?: Array<{
    morningstarId: string;
    name: string;
    url: string;
    score: number;
  }>;
  error?: string;
}

/**
 * Assets Service Interface
 * Defines the contract for asset resolution and management operations
 */
export interface IAssetsService {
  /**
   * Resolve an asset identifier (ISIN, Morningstar ID, or ticker)
   * First checks cache, then attempts external resolution
   * @param dto - Resolution request containing the identifier
   */
  resolve(dto: ResolveAssetDto): Promise<ResolveAssetResponse>;

  /**
   * Get a cached asset by its internal UUID
   * @param id - Internal asset UUID
   * @throws NotFoundException if asset not found
   */
  getById(id: string): Promise<Asset>;

  /**
   * Confirm and save an asset manually
   * Used when automatic resolution fails
   * @param dto - Asset data to confirm
   */
  confirm(dto: ConfirmAssetDto): Promise<Asset>;

  /**
   * Update ISIN for an existing asset
   * Used for manual ISIN entry
   * @param id - Asset UUID
   * @param isin - New ISIN value
   * @throws NotFoundException if asset not found
   */
  updateIsin(id: string, isin: string): Promise<Asset>;
}

/**
 * Injection token for IAssetsService
 */
export const ASSETS_SERVICE = Symbol('ASSETS_SERVICE');
