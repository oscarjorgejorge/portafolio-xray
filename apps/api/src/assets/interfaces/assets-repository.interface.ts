import { Asset, AssetSource, AssetType } from '@prisma/client';

/**
 * Assets Repository Interface
 * Defines the contract for asset data persistence operations
 */
export interface IAssetsRepository {
  /**
   * Find an asset by its ISIN
   * @param isin - International Securities Identification Number
   */
  findByIsin(isin: string): Promise<Asset | null>;

  /**
   * Find an asset by its Morningstar ID
   * @param morningstarId - Morningstar unique identifier
   */
  findByMorningstarId(morningstarId: string): Promise<Asset | null>;

  /**
   * Find multiple assets by their Morningstar IDs in a single query
   * @param morningstarIds - Array of Morningstar IDs to look up
   * @returns Array of found assets (may be fewer than input if some don't exist)
   */
  findManyByMorningstarIds(morningstarIds: string[]): Promise<Asset[]>;

  /**
   * Find multiple assets by their ISINs in a single query
   * Optimizes batch lookups to avoid N+1 queries
   * @param isins - Array of ISINs to look up
   * @returns Array of found assets (may be fewer than input if some don't exist)
   */
  findManyByIsins(isins: string[]): Promise<Asset[]>;

  /**
   * Find an asset by its internal UUID
   * @param id - Internal asset UUID
   */
  findById(id: string): Promise<Asset | null>;

  /**
   * Create a new asset
   * @param data - Asset data to create
   */
  create(data: CreateAssetData): Promise<Asset>;

  /**
   * Update an existing asset
   * @param id - Asset UUID
   * @param data - Partial asset data to update
   */
  update(id: string, data: UpdateAssetData): Promise<Asset>;

  /**
   * Create or update asset by ISIN
   * @param data - Asset data for upsert operation
   */
  upsertByIsin(data: UpsertAssetByIsinData): Promise<Asset>;

  /**
   * Create or update asset by Morningstar ID
   * Used when ISIN is not available
   * @param data - Asset data for upsert operation
   */
  upsertByMorningstarId(data: UpsertAssetByMorningstarIdData): Promise<Asset>;

  /**
   * Update ISIN for an asset and mark enrichment as complete
   * @param assetId - Asset UUID
   * @param isin - New ISIN value
   * @param isManual - Whether the ISIN was manually entered by user
   */
  updateIsin(assetId: string, isin: string, isManual?: boolean): Promise<Asset>;

  /**
   * Verify asset exists and update ISIN atomically using a transaction
   * This method ensures no race conditions between checking existence and updating
   * @param assetId - Asset UUID
   * @param isin - New ISIN value
   * @param isManual - Whether the ISIN was manually entered by user
   * @returns Updated asset
   * @throws EntityNotFoundException if asset not found
   */
  updateIsinWithVerification(
    assetId: string,
    isin: string,
    isManual?: boolean,
  ): Promise<Asset>;

  /**
   * Mark ISIN enrichment as complete (even if ISIN was not found)
   * @param assetId - Asset UUID
   */
  markIsinEnrichmentComplete(assetId: string): Promise<Asset>;
}

/**
 * Data required to create a new asset
 */
export interface CreateAssetData {
  isin: string;
  morningstarId: string;
  name: string;
  type: AssetType;
  url: string;
  source: AssetSource;
  ticker?: string;
}

/**
 * Data required to upsert an asset by ISIN
 */
export interface UpsertAssetByIsinData {
  isin: string;
  morningstarId: string;
  name: string;
  type: AssetType;
  url: string;
  source: AssetSource;
  ticker?: string;
}

/**
 * Data required to upsert an asset by Morningstar ID
 */
export interface UpsertAssetByMorningstarIdData {
  isin: string | null;
  morningstarId: string;
  name: string;
  type: AssetType;
  url: string;
  source: AssetSource;
  ticker?: string;
  isinPending?: boolean;
}

/**
 * Data for partial asset update (ORM-agnostic)
 * All fields are optional - only provided fields will be updated
 */
export interface UpdateAssetData {
  isin?: string | null;
  morningstarId?: string;
  ticker?: string | null;
  name?: string;
  type?: AssetType;
  url?: string;
  source?: AssetSource;
  isinPending?: boolean;
  isinManual?: boolean;
}

/**
 * Injection token for IAssetsRepository
 */
export const ASSETS_REPOSITORY = Symbol('ASSETS_REPOSITORY');
