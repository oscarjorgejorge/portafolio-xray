import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePortfolioBuilder } from './usePortfolioBuilder';
import { createMockPortfolioAsset, createMockAsset } from '@/test/fixtures';
import { AllProviders } from '@/test/test-utils';

const wrapper = AllProviders;

describe('usePortfolioBuilder', () => {
  describe('initial state', () => {
    it('should start with empty assets and percentage mode', () => {
      const { result } = renderHook(() => usePortfolioBuilder(), { wrapper });

      expect(result.current.assets).toEqual([]);
      expect(result.current.allocationMode).toBe('percentage');
      expect(result.current.showClearAllConfirmation).toBe(false);
      expect(result.current.isValid).toBe(false);
      expect(result.current.totalWeight).toBe(0);
    });

    it('should initialize with provided initialAssets', () => {
      const initial = [
        createMockPortfolioAsset({ id: '1', weight: 60 }),
        createMockPortfolioAsset({ id: '2', weight: 40 }),
      ];
      const { result } = renderHook(
        () => usePortfolioBuilder({ initialAssets: initial }),
        { wrapper }
      );

      expect(result.current.assets).toHaveLength(2);
      expect(result.current.totalWeight).toBe(100);
      expect(result.current.isValid).toBe(true);
    });
  });

  describe('allocation mode', () => {
    it('should update allocationMode when setAllocationMode is called', () => {
      const { result } = renderHook(() => usePortfolioBuilder(), { wrapper });

      expect(result.current.allocationMode).toBe('percentage');

      act(() => {
        result.current.setAllocationMode('amount');
      });

      expect(result.current.allocationMode).toBe('amount');

      act(() => {
        result.current.setAllocationMode('percentage');
      });

      expect(result.current.allocationMode).toBe('percentage');
    });
  });

  describe('handleClearAll and handleConfirmClearAll', () => {
    it('should show confirmation when handleClearAll is called', () => {
      const initial = [createMockPortfolioAsset({ id: '1' })];
      const { result } = renderHook(
        () => usePortfolioBuilder({ initialAssets: initial }),
        { wrapper }
      );

      expect(result.current.showClearAllConfirmation).toBe(false);

      act(() => {
        result.current.handleClearAll();
      });

      expect(result.current.showClearAllConfirmation).toBe(true);
    });

    it('should clear assets and hide confirmation when handleConfirmClearAll is called', () => {
      const initial = [
        createMockPortfolioAsset({ id: '1' }),
        createMockPortfolioAsset({ id: '2' }),
      ];
      const { result } = renderHook(
        () => usePortfolioBuilder({ initialAssets: initial }),
        { wrapper }
      );

      act(() => {
        result.current.handleClearAll();
      });
      expect(result.current.showClearAllConfirmation).toBe(true);

      act(() => {
        result.current.handleConfirmClearAll();
      });

      expect(result.current.assets).toHaveLength(0);
      expect(result.current.showClearAllConfirmation).toBe(false);
    });
  });

  describe('handleAssetResolved', () => {
    it('should add asset and clear shareable URL', () => {
      const { result } = renderHook(() => usePortfolioBuilder(), { wrapper });
      const newAsset = createMockPortfolioAsset({
        id: 'new-1',
        weight: 100,
        asset: createMockAsset({ morningstarId: '0P0000YXJO' }),
      });

      expect(result.current.assets).toHaveLength(0);
      expect(result.current.shareableUrl).toBeNull();

      act(() => {
        result.current.handleAssetResolved(newAsset);
      });

      expect(result.current.assets).toHaveLength(1);
      expect(result.current.assets[0].id).toBe('new-1');
      expect(result.current.shareableUrl).toBeNull();
    });

    it('should open alternatives modal when asset has low_confidence status', () => {
      const { result } = renderHook(() => usePortfolioBuilder(), { wrapper });
      const lowConfidenceAsset = createMockPortfolioAsset({
        id: 'low-1',
        status: 'low_confidence',
        weight: 100,
      });

      act(() => {
        result.current.handleAssetResolved(lowConfidenceAsset);
      });

      expect(result.current.selectedAssetForAlternatives).not.toBeNull();
      expect(result.current.selectedAssetForAlternatives?.id).toBe('low-1');
    });
  });

  describe('getAssetById', () => {
    it('should return asset by id', () => {
      const initial = [
        createMockPortfolioAsset({ id: 'a1' }),
        createMockPortfolioAsset({ id: 'a2' }),
      ];
      const { result } = renderHook(
        () => usePortfolioBuilder({ initialAssets: initial }),
        { wrapper }
      );

      expect(result.current.getAssetById('a1')?.id).toBe('a1');
      expect(result.current.getAssetById('a2')?.id).toBe('a2');
      expect(result.current.getAssetById('missing')).toBeUndefined();
    });
  });
});
