import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDuplicateCheck } from './useDuplicateCheck';
import {
  createMockPortfolioAsset,
  createMockAsset,
} from '@/test/fixtures';

describe('useDuplicateCheck', () => {
  describe('empty asset list', () => {
    it('should never detect duplicates when list is empty', () => {
      const { result } = renderHook(() => useDuplicateCheck([]));

      expect(result.current.checkDuplicate('IE00B4L5Y983')).toBe(false);
      expect(result.current.checkDuplicate('ANY_IDENTIFIER')).toBe(false);
    });
  });

  describe('identifier matching', () => {
    it('should detect duplicate by exact identifier match', () => {
      const existingAssets = [
        createMockPortfolioAsset({ identifier: 'IE00B4L5Y983' }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(result.current.checkDuplicate('IE00B4L5Y983')).toBe(true);
    });

    it('should detect duplicate case-insensitively', () => {
      const existingAssets = [
        createMockPortfolioAsset({ identifier: 'IE00B4L5Y983' }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(result.current.checkDuplicate('ie00b4l5y983')).toBe(true);
      expect(result.current.checkDuplicate('Ie00B4L5y983')).toBe(true);
    });

    it('should not detect duplicate for different identifier', () => {
      const existingAssets = [
        createMockPortfolioAsset({ identifier: 'IE00B4L5Y983' }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(result.current.checkDuplicate('US0378331005')).toBe(false);
    });
  });

  describe('ISIN matching', () => {
    it('should detect duplicate by resolved ISIN', () => {
      const existingAssets = [
        createMockPortfolioAsset({
          identifier: 'VWCE',
          asset: createMockAsset({ isin: 'IE00B4L5Y983' }),
        }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      // Different identifier but same ISIN in resolved asset
      expect(
        result.current.checkDuplicate('SOME_OTHER', { isin: 'IE00B4L5Y983' })
      ).toBe(true);
    });

    it('should detect duplicate by ISIN case-insensitively', () => {
      const existingAssets = [
        createMockPortfolioAsset({
          identifier: 'VWCE',
          asset: createMockAsset({ isin: 'IE00B4L5Y983' }),
        }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(
        result.current.checkDuplicate('SOMETHING', { isin: 'ie00b4l5y983' })
      ).toBe(true);
    });

    it('should not detect duplicate when ISINs are different', () => {
      const existingAssets = [
        createMockPortfolioAsset({
          asset: createMockAsset({ isin: 'IE00B4L5Y983' }),
        }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(
        result.current.checkDuplicate('DIFFERENT', { isin: 'US0378331005' })
      ).toBe(false);
    });

    it('should not match when existing asset has no ISIN', () => {
      const existingAssets = [
        createMockPortfolioAsset({
          asset: createMockAsset({ isin: null }),
        }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(
        result.current.checkDuplicate('SOMETHING', { isin: 'IE00B4L5Y983' })
      ).toBe(false);
    });

    it('should not match when resolved asset info has no ISIN', () => {
      const existingAssets = [
        createMockPortfolioAsset({
          asset: createMockAsset({ isin: 'IE00B4L5Y983' }),
        }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(
        result.current.checkDuplicate('SOMETHING', { isin: null })
      ).toBe(false);
    });
  });

  describe('Morningstar ID matching', () => {
    it('should detect duplicate by Morningstar ID', () => {
      const existingAssets = [
        createMockPortfolioAsset({
          identifier: 'VWCE',
          asset: createMockAsset({ morningstarId: 'F00000WU13' }),
        }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(
        result.current.checkDuplicate('DIFFERENT', { morningstarId: 'F00000WU13' })
      ).toBe(true);
    });

    it('should not detect duplicate for different Morningstar ID', () => {
      const existingAssets = [
        createMockPortfolioAsset({
          asset: createMockAsset({ morningstarId: 'F00000WU13' }),
        }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(
        result.current.checkDuplicate('DIFFERENT', { morningstarId: 'F00000XXXX' })
      ).toBe(false);
    });

    it('should not match when existing asset has no Morningstar ID', () => {
      const existingAssets = [
        createMockPortfolioAsset({
          asset: undefined,
        }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(
        result.current.checkDuplicate('SOMETHING', { morningstarId: 'F00000WU13' })
      ).toBe(false);
    });
  });

  describe('multiple assets', () => {
    it('should find duplicate among multiple assets', () => {
      const existingAssets = [
        createMockPortfolioAsset({ identifier: 'ASSET1' }),
        createMockPortfolioAsset({ identifier: 'ASSET2' }),
        createMockPortfolioAsset({ identifier: 'ASSET3' }),
      ];
      const { result } = renderHook(() => useDuplicateCheck(existingAssets));

      expect(result.current.checkDuplicate('ASSET2')).toBe(true);
      expect(result.current.checkDuplicate('ASSET4')).toBe(false);
    });
  });
});
