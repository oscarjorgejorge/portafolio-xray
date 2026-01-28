import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePortfolioValidation } from './usePortfolioValidation';
import {
  createResolvedAsset,
  createPendingAsset,
  createMockPortfolioAsset,
} from '@/test/fixtures';
import type { AllocationMode } from '@/types';

describe('usePortfolioValidation', () => {
  describe('empty portfolio', () => {
    it('should return isValid: false for empty portfolio', () => {
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets: [], allocationMode: 'percentage' })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.totalWeight).toBe(0);
      expect(result.current.remainingWeight).toBe(100);
    });

    it('should return allResolved: true for empty portfolio (vacuously true)', () => {
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets: [], allocationMode: 'percentage' })
      );

      expect(result.current.allResolved).toBe(true);
    });
  });

  describe('unresolved assets', () => {
    it('should return isValid: false when assets are pending', () => {
      const assets = [
        createPendingAsset({ weight: 50 }),
        createResolvedAsset({ weight: 50 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.allResolved).toBe(false);
    });

    it('should return isValid: false when asset has no resolved data', () => {
      const assets = [
        createMockPortfolioAsset({ status: 'resolved', asset: undefined, weight: 100 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.allResolved).toBe(false);
    });
  });

  describe('percentage mode validation', () => {
    it('should return isValid: true when total is exactly 100%', () => {
      const assets = [
        createResolvedAsset({ weight: 60 }),
        createResolvedAsset({ id: '2', weight: 40 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.isValid).toBe(true);
      expect(result.current.totalWeight).toBe(100);
      expect(result.current.remainingWeight).toBe(0);
    });

    it('should return isValid: false when total is significantly below 100%', () => {
      const assets = [
        createResolvedAsset({ weight: 50 }),
        createResolvedAsset({ id: '2', weight: 49 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.totalWeight).toBe(99);
      expect(result.current.remainingWeight).toBe(1);
    });

    it('should return isValid: false when total is significantly above 100%', () => {
      const assets = [
        createResolvedAsset({ weight: 60 }),
        createResolvedAsset({ id: '2', weight: 50 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.totalWeight).toBe(110);
      expect(result.current.remainingWeight).toBe(-10);
    });

    it('should accept values within tolerance (99.995%)', () => {
      const assets = [createResolvedAsset({ weight: 99.995 })];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      // 100 - 99.995 = 0.005 < 0.01 tolerance
      expect(result.current.isValid).toBe(true);
    });

    it('should accept values within tolerance (100.005%)', () => {
      const assets = [createResolvedAsset({ weight: 100.005 })];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      // 100.005 - 100 = 0.005 < 0.01 tolerance
      expect(result.current.isValid).toBe(true);
    });

    it('should reject values outside tolerance (99.5%)', () => {
      const assets = [createResolvedAsset({ weight: 99.5 })];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.isValid).toBe(false);
    });
  });

  describe('amount mode validation', () => {
    it('should return isValid: true for any positive total weight', () => {
      const assets = [
        createResolvedAsset({ weight: 1000 }),
        createResolvedAsset({ id: '2', weight: 500 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'amount' })
      );

      expect(result.current.isValid).toBe(true);
      expect(result.current.totalWeight).toBe(1500);
    });

    it('should return isValid: true for small positive amounts', () => {
      const assets = [createResolvedAsset({ weight: 0.01 })];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'amount' })
      );

      expect(result.current.isValid).toBe(true);
    });

    it('should return isValid: false when total is zero', () => {
      const assets = [
        createResolvedAsset({ weight: 0 }),
        createResolvedAsset({ id: '2', weight: 0 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'amount' })
      );

      expect(result.current.isValid).toBe(false);
    });

    it('should not care about 100% limit in amount mode', () => {
      const assets = [
        createResolvedAsset({ weight: 5000 }),
        createResolvedAsset({ id: '2', weight: 10000 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'amount' })
      );

      expect(result.current.isValid).toBe(true);
      expect(result.current.totalWeight).toBe(15000);
    });
  });

  describe('totalWeight calculation', () => {
    it('should sum all asset weights', () => {
      const assets = [
        createResolvedAsset({ weight: 25 }),
        createResolvedAsset({ id: '2', weight: 35 }),
        createResolvedAsset({ id: '3', weight: 40 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.totalWeight).toBe(100);
    });

    it('should treat undefined/null weights as 0', () => {
      const assets = [
        createResolvedAsset({ weight: 50 }),
        createResolvedAsset({ id: '2', weight: 0 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.totalWeight).toBe(50);
    });

    it('should handle decimal weights correctly', () => {
      const assets = [
        createResolvedAsset({ weight: 33.33 }),
        createResolvedAsset({ id: '2', weight: 33.33 }),
        createResolvedAsset({ id: '3', weight: 33.34 }),
      ];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.totalWeight).toBe(100);
      expect(result.current.isValid).toBe(true);
    });
  });

  describe('remainingWeight calculation', () => {
    it('should calculate remaining weight correctly', () => {
      const assets = [createResolvedAsset({ weight: 75 })];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.remainingWeight).toBe(25);
    });

    it('should show negative remaining when over 100%', () => {
      const assets = [createResolvedAsset({ weight: 120 })];
      const { result } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );

      expect(result.current.remainingWeight).toBe(-20);
    });
  });

  describe('mode switching', () => {
    const createTestAssets = () => [
      createResolvedAsset({ weight: 50 }),
      createResolvedAsset({ id: '2', weight: 30 }),
    ];

    it('should correctly validate when switching modes', () => {
      const assets = createTestAssets();

      // In percentage mode, 80% is invalid
      const { result: percentageResult } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'percentage' })
      );
      expect(percentageResult.current.isValid).toBe(false);

      // In amount mode, 80 total is valid
      const { result: amountResult } = renderHook(() =>
        usePortfolioValidation({ assets, allocationMode: 'amount' })
      );
      expect(amountResult.current.isValid).toBe(true);
    });
  });
});
