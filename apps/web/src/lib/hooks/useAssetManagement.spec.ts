import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssetManagement } from './useAssetManagement';
import {
  createMockPortfolioAsset,
  createMockAsset,
  createPendingAsset,
} from '@/test/fixtures';

describe('useAssetManagement', () => {
  describe('initial state', () => {
    it('should start with empty array when no initial assets provided', () => {
      const { result } = renderHook(() => useAssetManagement());

      expect(result.current.assets).toEqual([]);
    });

    it('should initialize with provided assets', () => {
      const initialAssets = [
        createMockPortfolioAsset({ id: '1' }),
        createMockPortfolioAsset({ id: '2' }),
      ];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      expect(result.current.assets).toHaveLength(2);
      expect(result.current.assets[0].id).toBe('1');
      expect(result.current.assets[1].id).toBe('2');
    });
  });

  describe('addAsset', () => {
    it('should add asset to the end of the list', () => {
      const { result } = renderHook(() => useAssetManagement());
      const newAsset = createMockPortfolioAsset({ id: 'new-asset' });

      act(() => {
        result.current.addAsset(newAsset);
      });

      expect(result.current.assets).toHaveLength(1);
      expect(result.current.assets[0].id).toBe('new-asset');
    });

    it('should preserve existing assets when adding new one', () => {
      const initialAssets = [createMockPortfolioAsset({ id: 'existing' })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );
      const newAsset = createMockPortfolioAsset({ id: 'new-asset' });

      act(() => {
        result.current.addAsset(newAsset);
      });

      expect(result.current.assets).toHaveLength(2);
      expect(result.current.assets[0].id).toBe('existing');
      expect(result.current.assets[1].id).toBe('new-asset');
    });

    it('should call onAssetsChange callback', () => {
      const onAssetsChange = vi.fn();
      const { result } = renderHook(() =>
        useAssetManagement({ onAssetsChange })
      );

      act(() => {
        result.current.addAsset(createMockPortfolioAsset());
      });

      expect(onAssetsChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeAsset', () => {
    it('should remove asset by id', () => {
      const initialAssets = [
        createMockPortfolioAsset({ id: '1' }),
        createMockPortfolioAsset({ id: '2' }),
        createMockPortfolioAsset({ id: '3' }),
      ];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.removeAsset('2');
      });

      expect(result.current.assets).toHaveLength(2);
      expect(result.current.assets.map((a) => a.id)).toEqual(['1', '3']);
    });

    it('should handle removing non-existent asset gracefully', () => {
      const initialAssets = [createMockPortfolioAsset({ id: '1' })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.removeAsset('non-existent');
      });

      expect(result.current.assets).toHaveLength(1);
    });

    it('should call onAssetsChange callback', () => {
      const onAssetsChange = vi.fn();
      const initialAssets = [createMockPortfolioAsset({ id: '1' })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets, onAssetsChange })
      );

      act(() => {
        result.current.removeAsset('1');
      });

      expect(onAssetsChange).toHaveBeenCalled();
    });
  });

  describe('updateWeight', () => {
    it('should update weight of specific asset', () => {
      const initialAssets = [
        createMockPortfolioAsset({ id: '1', weight: 50 }),
        createMockPortfolioAsset({ id: '2', weight: 50 }),
      ];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.updateWeight('1', 75);
      });

      expect(result.current.assets[0].weight).toBe(75);
      expect(result.current.assets[1].weight).toBe(50); // unchanged
    });

    it('should not modify other asset properties', () => {
      const initialAssets = [
        createMockPortfolioAsset({ id: '1', identifier: 'TEST', weight: 50 }),
      ];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.updateWeight('1', 100);
      });

      expect(result.current.assets[0].identifier).toBe('TEST');
      expect(result.current.assets[0].weight).toBe(100);
    });

    it('should handle updating non-existent asset gracefully', () => {
      const initialAssets = [createMockPortfolioAsset({ id: '1', weight: 50 })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.updateWeight('non-existent', 100);
      });

      expect(result.current.assets[0].weight).toBe(50);
    });

    it('should call onAssetsChange callback', () => {
      const onAssetsChange = vi.fn();
      const initialAssets = [createMockPortfolioAsset({ id: '1' })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets, onAssetsChange })
      );

      act(() => {
        result.current.updateWeight('1', 75);
      });

      expect(onAssetsChange).toHaveBeenCalled();
    });
  });

  describe('updateAsset', () => {
    it('should update resolved asset data', () => {
      const initialAssets = [createMockPortfolioAsset({ id: '1' })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      const updatedAsset = createMockAsset({
        name: 'Updated Name',
        isin: 'NEWISIN12345',
      });

      act(() => {
        result.current.updateAsset('1', updatedAsset);
      });

      expect(result.current.assets[0].asset?.name).toBe('Updated Name');
      expect(result.current.assets[0].asset?.isin).toBe('NEWISIN12345');
    });

    it('should update isinPending flag', () => {
      const initialAssets = [createMockPortfolioAsset({ id: '1' })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      const updatedAsset = createMockAsset({ isinPending: true });

      act(() => {
        result.current.updateAsset('1', updatedAsset);
      });

      expect(result.current.assets[0].isinPending).toBe(true);
    });
  });

  describe('resolveAssetManually', () => {
    it('should update asset status to resolved', () => {
      const initialAssets = [createPendingAsset({ id: '1', identifier: 'TESTID' })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.resolveAssetManually(
          '1',
          'F00000WU13',
          'Test Fund',
          'https://morningstar.com/fund'
        );
      });

      expect(result.current.assets[0].status).toBe('resolved');
      expect(result.current.assets[0].asset).toBeDefined();
      expect(result.current.assets[0].asset?.morningstarId).toBe('F00000WU13');
      expect(result.current.assets[0].asset?.name).toBe('Test Fund');
      expect(result.current.assets[0].asset?.url).toBe('https://morningstar.com/fund');
    });

    it('should set ISIN from identifier', () => {
      const initialAssets = [
        createPendingAsset({ id: '1', identifier: 'IE00B4L5Y983' }),
      ];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.resolveAssetManually(
          '1',
          'F00000WU13',
          'Test Fund',
          'https://morningstar.com/fund'
        );
      });

      expect(result.current.assets[0].asset?.isin).toBe('IE00B4L5Y983');
    });

    it('should set source as manual', () => {
      const initialAssets = [createPendingAsset({ id: '1' })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.resolveAssetManually(
          '1',
          'F00000WU13',
          'Test Fund',
          'https://morningstar.com/fund'
        );
      });

      expect(result.current.assets[0].asset?.source).toBe('manual');
    });

    it('should set type as FUND', () => {
      const initialAssets = [createPendingAsset({ id: '1' })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.resolveAssetManually(
          '1',
          'F00000WU13',
          'Test Fund',
          'https://morningstar.com/fund'
        );
      });

      expect(result.current.assets[0].asset?.type).toBe('FUND');
    });
  });

  describe('clearAll', () => {
    it('should remove all assets', () => {
      const initialAssets = [
        createMockPortfolioAsset({ id: '1' }),
        createMockPortfolioAsset({ id: '2' }),
        createMockPortfolioAsset({ id: '3' }),
      ];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.assets).toEqual([]);
    });

    it('should call onAssetsChange callback', () => {
      const onAssetsChange = vi.fn();
      const initialAssets = [createMockPortfolioAsset()];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets, onAssetsChange })
      );

      act(() => {
        result.current.clearAll();
      });

      expect(onAssetsChange).toHaveBeenCalled();
    });
  });

  describe('getAssetById', () => {
    it('should return asset when found', () => {
      const initialAssets = [
        createMockPortfolioAsset({ id: '1', identifier: 'FIRST' }),
        createMockPortfolioAsset({ id: '2', identifier: 'SECOND' }),
      ];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      const found = result.current.getAssetById('2');

      expect(found).toBeDefined();
      expect(found?.identifier).toBe('SECOND');
    });

    it('should return undefined when not found', () => {
      const initialAssets = [createMockPortfolioAsset({ id: '1' })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      const found = result.current.getAssetById('non-existent');

      expect(found).toBeUndefined();
    });

    it('should return updated asset after modification', () => {
      const initialAssets = [createMockPortfolioAsset({ id: '1', weight: 50 })];
      const { result } = renderHook(() =>
        useAssetManagement({ initialAssets })
      );

      act(() => {
        result.current.updateWeight('1', 75);
      });

      const found = result.current.getAssetById('1');
      expect(found?.weight).toBe(75);
    });
  });

  describe('initialAssets sync', () => {
    it('should sync when initialAssets prop changes with non-empty array', () => {
      const { result, rerender } = renderHook(
        ({ initialAssets }) => useAssetManagement({ initialAssets }),
        { initialProps: { initialAssets: [] as any[] } }
      );

      expect(result.current.assets).toHaveLength(0);

      const newAssets = [createMockPortfolioAsset({ id: 'from-url' })];
      rerender({ initialAssets: newAssets });

      expect(result.current.assets).toHaveLength(1);
      expect(result.current.assets[0].id).toBe('from-url');
    });
  });
});
