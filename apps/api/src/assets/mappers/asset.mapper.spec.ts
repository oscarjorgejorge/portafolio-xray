import { toResolvedAssetDto, toResolvedAssetDtoList } from './asset.mapper';
import { AssetType, AssetSource } from '@prisma/client';

describe('asset.mapper', () => {
  const createMockAsset = (overrides = {}) => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    isin: 'IE00B4L5Y983',
    morningstarId: '0P0000YXJO',
    ticker: 'IWDA',
    name: 'iShares Core MSCI World UCITS ETF',
    type: AssetType.ETF,
    url: 'https://www.morningstar.es/es/etf/snapshot/snapshot.aspx?id=0P0000YXJO',
    source: AssetSource.web_search,
    isinPending: false,
    isinManual: false,
    tickerManual: false,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-16T12:00:00Z'),
    ...overrides,
  });

  describe('toResolvedAssetDto', () => {
    it('should map all public fields correctly', () => {
      const asset = createMockAsset();
      const dto = toResolvedAssetDto(asset);

      expect(dto.id).toBe(asset.id);
      expect(dto.isin).toBe(asset.isin);
      expect(dto.morningstarId).toBe(asset.morningstarId);
      expect(dto.ticker).toBe(asset.ticker);
      expect(dto.name).toBe(asset.name);
      expect(dto.type).toBe(asset.type);
      expect(dto.url).toBe(asset.url);
      expect(dto.source).toBe(asset.source);
    });

    it('should NOT include createdAt field', () => {
      const asset = createMockAsset();
      const dto = toResolvedAssetDto(asset);

      expect(dto).not.toHaveProperty('createdAt');
    });

    it('should NOT include updatedAt field', () => {
      const asset = createMockAsset();
      const dto = toResolvedAssetDto(asset);

      expect(dto).not.toHaveProperty('updatedAt');
    });

    it('should NOT include isinPending field', () => {
      const asset = createMockAsset();
      const dto = toResolvedAssetDto(asset);

      expect(dto).not.toHaveProperty('isinPending');
    });

    it('should NOT include isinManual field', () => {
      const asset = createMockAsset();
      const dto = toResolvedAssetDto(asset);

      expect(dto).not.toHaveProperty('isinManual');
    });

    it('should handle null ISIN', () => {
      const asset = createMockAsset({ isin: null });
      const dto = toResolvedAssetDto(asset);

      expect(dto.isin).toBeNull();
    });

    it('should handle null ticker', () => {
      const asset = createMockAsset({ ticker: null });
      const dto = toResolvedAssetDto(asset);

      expect(dto.ticker).toBeNull();
    });

    it('should preserve different asset types', () => {
      const fundAsset = createMockAsset({ type: AssetType.FUND });
      const stockAsset = createMockAsset({ type: AssetType.STOCK });
      const etcAsset = createMockAsset({ type: AssetType.ETC });

      expect(toResolvedAssetDto(fundAsset).type).toBe(AssetType.FUND);
      expect(toResolvedAssetDto(stockAsset).type).toBe(AssetType.STOCK);
      expect(toResolvedAssetDto(etcAsset).type).toBe(AssetType.ETC);
    });

    it('should preserve different source types', () => {
      const manualAsset = createMockAsset({ source: AssetSource.manual });
      const webSearchAsset = createMockAsset({
        source: AssetSource.web_search,
      });
      const importedAsset = createMockAsset({ source: AssetSource.imported });

      expect(toResolvedAssetDto(manualAsset).source).toBe(AssetSource.manual);
      expect(toResolvedAssetDto(webSearchAsset).source).toBe(
        AssetSource.web_search,
      );
      expect(toResolvedAssetDto(importedAsset).source).toBe(
        AssetSource.imported,
      );
    });
  });

  describe('toResolvedAssetDtoList', () => {
    it('should map array of assets correctly', () => {
      const assets = [
        createMockAsset({ id: 'id-1', morningstarId: '0P0000YXJO' }),
        createMockAsset({ id: 'id-2', morningstarId: 'F00000THA5' }),
        createMockAsset({ id: 'id-3', morningstarId: 'F000016RL3' }),
      ];

      const dtos = toResolvedAssetDtoList(assets);

      expect(dtos).toHaveLength(3);
      expect(dtos[0].id).toBe('id-1');
      expect(dtos[1].id).toBe('id-2');
      expect(dtos[2].id).toBe('id-3');
    });

    it('should return empty array for empty input', () => {
      const dtos = toResolvedAssetDtoList([]);

      expect(dtos).toEqual([]);
    });

    it('should NOT include internal fields in any mapped items', () => {
      const assets = [
        createMockAsset({ id: 'id-1' }),
        createMockAsset({ id: 'id-2' }),
      ];

      const dtos = toResolvedAssetDtoList(assets);

      dtos.forEach((dto) => {
        expect(dto).not.toHaveProperty('createdAt');
        expect(dto).not.toHaveProperty('updatedAt');
        expect(dto).not.toHaveProperty('isinPending');
        expect(dto).not.toHaveProperty('isinManual');
      });
    });
  });
});
