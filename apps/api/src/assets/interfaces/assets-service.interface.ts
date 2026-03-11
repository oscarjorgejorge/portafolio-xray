import { ResolveAssetDto, ConfirmAssetDto, BatchResolveAssetDto } from '../dto';
import {
  ResolveAssetResponse,
  BatchResolveAssetResponse,
  ResolvedAssetDto,
} from '../types';

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
   * Batch resolve multiple assets in a single request
   * Optimized to reduce N+1 API calls from the frontend
   * @param dto - Batch resolution request with up to 20 assets
   */
  resolveBatch(dto: BatchResolveAssetDto): Promise<BatchResolveAssetResponse>;

  /**
   * Get a cached asset by its internal UUID
   * @param id - Internal asset UUID
   * @throws NotFoundException if asset not found
   */
  getById(id: string): Promise<ResolvedAssetDto>;

  /**
   * Confirm and save an asset manually
   * Used when automatic resolution fails
   * @param dto - Asset data to confirm
   */
  confirm(dto: ConfirmAssetDto): Promise<ResolvedAssetDto>;

  /**
   * Update ISIN for an existing asset
   * Used for manual ISIN entry
   * @param id - Asset UUID
   * @param isin - New ISIN value
   * @throws NotFoundException if asset not found
   */
  updateIsin(id: string, isin: string): Promise<ResolvedAssetDto>;

  /**
   * Update ticker for an existing asset
   * Used for manual ticker entry, primarily for stocks
   * @param id - Asset UUID
   * @param ticker - New ticker value
   * @throws NotFoundException if asset not found
   */
  updateTicker(id: string, ticker: string): Promise<ResolvedAssetDto>;
}

/**
 * Injection token for IAssetsService
 */
export const ASSETS_SERVICE = Symbol('ASSETS_SERVICE');
