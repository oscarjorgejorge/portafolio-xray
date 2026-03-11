import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useXRayGeneration } from './useXRayGeneration';
import { createMockPortfolioAsset, createMockAsset } from '@/test/fixtures';
import { AllProviders } from '@/test/test-utils';

const mockGenerateXRay = vi.fn();
vi.mock('@/lib/api/xray', () => ({ generateXRay: (...args: unknown[]) => mockGenerateXRay(...args) }));
vi.mock('@/lib/services/errorReporting', () => ({ captureException: vi.fn() }));

const wrapper = AllProviders;

describe('useXRayGeneration', () => {
  const resolvedAsset = createMockPortfolioAsset({
    id: '1',
    weight: 60,
    asset: createMockAsset({ morningstarId: '0P0000YXJO' }),
  });
  const resolvedAsset2 = createMockPortfolioAsset({
    id: '2',
    weight: 40,
    asset: createMockAsset({ morningstarId: 'F00000THA5' }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
    mockGenerateXRay.mockResolvedValue({
      shareableUrl: '/xray?assets=...',
      morningstarUrl: 'https://lt.morningstar.com/...',
    });
  });

  describe('generate', () => {
    it('should not call API when isValid is false', async () => {
      const { result } = renderHook(
        () =>
          useXRayGeneration({
            assets: [resolvedAsset, resolvedAsset2],
            allocationMode: 'percentage',
            isValid: false,
          }),
        { wrapper }
      );

      act(() => {
        result.current.generate();
      });

      await waitFor(() => {
        expect(mockGenerateXRay).not.toHaveBeenCalled();
      });
    });

    it('should call API with percentage weights when allocationMode is percentage', async () => {
      const { result } = renderHook(
        () =>
          useXRayGeneration({
            assets: [resolvedAsset, resolvedAsset2],
            allocationMode: 'percentage',
            isValid: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.generate();
      });

      await waitFor(() => {
        expect(mockGenerateXRay).toHaveBeenCalled();
        expect(mockGenerateXRay.mock.calls[0][0]).toEqual([
          { morningstarId: '0P0000YXJO', weight: 60 },
          { morningstarId: 'F00000THA5', weight: 40 },
        ]);
      });
    });

    it('should call API with normalized weights when allocationMode is amount', async () => {
      const asset60 = createMockPortfolioAsset({
        id: '1',
        weight: 600,
        asset: createMockAsset({ morningstarId: '0P0000YXJO' }),
      });
      const asset40 = createMockPortfolioAsset({
        id: '2',
        weight: 400,
        asset: createMockAsset({ morningstarId: 'F00000THA5' }),
      });
      const { result } = renderHook(
        () =>
          useXRayGeneration({
            assets: [asset60, asset40],
            allocationMode: 'amount',
            isValid: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.generate();
      });

      await waitFor(() => {
        expect(mockGenerateXRay).toHaveBeenCalled();
        expect(mockGenerateXRay.mock.calls[0][0]).toEqual([
          { morningstarId: '0P0000YXJO', weight: 60 },
          { morningstarId: 'F00000THA5', weight: 40 },
        ]);
      });
    });

    it('should set shareableUrl and morningstarUrl on success', async () => {
      const { result } = renderHook(
        () =>
          useXRayGeneration({
            assets: [resolvedAsset],
            allocationMode: 'percentage',
            isValid: true,
          }),
        { wrapper }
      );

      expect(result.current.shareableUrl).toBeNull();
      expect(result.current.morningstarUrl).toBeNull();

      act(() => {
        result.current.generate();
      });

      await waitFor(() => {
        expect(result.current.shareableUrl).toBe('/xray?assets=...');
        expect(result.current.morningstarUrl).toBe('https://lt.morningstar.com/...');
      });
    });

    it('should clear URLs and set generateError on API failure', async () => {
      mockGenerateXRay.mockRejectedValueOnce(new Error('Network error'));
      const onError = vi.fn();
      const { result } = renderHook(
        () =>
          useXRayGeneration({
            assets: [resolvedAsset],
            allocationMode: 'percentage',
            isValid: true,
            onError,
          }),
        { wrapper }
      );

      act(() => {
        result.current.generate();
      });

      await waitFor(() => {
        expect(result.current.generateError).not.toBeNull();
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
      expect(result.current.shareableUrl).toBeNull();
    });
  });

  describe('clearUrls', () => {
    it('should clear shareableUrl and morningstarUrl', async () => {
      const { result } = renderHook(
        () =>
          useXRayGeneration({
            assets: [resolvedAsset],
            allocationMode: 'percentage',
            isValid: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.generate();
      });
      await waitFor(() => {
        expect(result.current.shareableUrl).not.toBeNull();
      });

      act(() => {
        result.current.clearUrls();
      });

      expect(result.current.shareableUrl).toBeNull();
      expect(result.current.morningstarUrl).toBeNull();
    });
  });
});
