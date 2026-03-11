import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsinPolling } from './useIsinPolling';
import { createMockAsset } from '@/test/fixtures';
import { getAssetById } from '@/lib/api/assets';
import { captureException } from '@/lib/services/errorReporting';

vi.mock('@/lib/api/assets', () => ({
  getAssetById: vi.fn(),
}));

vi.mock('@/lib/services/errorReporting', () => ({
  captureException: vi.fn(),
}));

const mockedGetAssetById = vi.mocked(getAssetById);
const mockedCaptureException = vi.mocked(captureException);

describe('useIsinPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    mockedGetAssetById.mockReset();
    mockedCaptureException.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops polling and calls onIsinResolved when ISIN is resolved', async () => {
    const assetWithIsin = createMockAsset({ isin: 'IE00B4L5Y983', isinPending: false });
    mockedGetAssetById.mockResolvedValue(assetWithIsin as any);
    const onIsinResolved = vi.fn();

    const { result } = renderHook(() =>
      useIsinPolling({
        assetId: 'asset-1',
        isinPending: true,
        onIsinResolved,
        interval: 1000,
        maxAttempts: 3,
      }),
    );

    expect(result.current.isPolling).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(50_000);
      await Promise.resolve();
    });

    expect(mockedGetAssetById).toHaveBeenCalled();
    expect(onIsinResolved).toHaveBeenCalledWith(assetWithIsin);
  });

  it('forces isinPending=false after maxAttempts are exhausted', async () => {
    const pendingAsset = createMockAsset({ isin: null, isinPending: true });
    mockedGetAssetById.mockResolvedValue(pendingAsset as any);
    const onIsinResolved = vi.fn();

    renderHook(() =>
      useIsinPolling({
        assetId: 'asset-1',
        isinPending: true,
        onIsinResolved,
        interval: 1000,
        maxAttempts: 2,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(onIsinResolved).toHaveBeenCalledTimes(1);
    const resolvedArg = onIsinResolved.mock.calls[0][0];
    expect(resolvedArg.isinPending).toBe(false);
  });

  it('captures exception and stops polling on error', async () => {
    mockedGetAssetById.mockRejectedValue(new Error('Network error'));
    const onIsinResolved = vi.fn();

    renderHook(() =>
      useIsinPolling({
        assetId: 'asset-1',
        isinPending: true,
        onIsinResolved,
        interval: 1000,
        maxAttempts: 2,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(1_500);
      await Promise.resolve();
    });

    expect(mockedCaptureException).toHaveBeenCalled();
    expect(onIsinResolved).not.toHaveBeenCalled();
  });
});

