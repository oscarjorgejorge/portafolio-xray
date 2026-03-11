import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShareableUrl } from './useShareableUrl';

vi.mock('@/lib/services/errorReporting', () => ({
  captureException: vi.fn(),
}));

describe('useShareableUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://example.com',
      },
      writable: true,
    });

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    (navigator as any).clipboard = {
      writeText: vi.fn(),
    };

    window.open = vi.fn();
  });

  it('builds fullShareableUrl when shareableUrl is set', () => {
    const { result } = renderHook(() =>
      useShareableUrl({ initialShareableUrl: '/xray?assets=123' }),
    );

    expect(result.current.fullShareableUrl).toBe(
      'https://example.com/xray?assets=123',
    );
  });

  it('persists URLs to sessionStorage and clears when both are null', () => {
    const { result } = renderHook(() =>
      useShareableUrl({ initialShareableUrl: '/xray?assets=123' }),
    );

    act(() => {
      result.current.setUrls('/xray?assets=456', 'https://ms.com/pdf');
    });

    expect(window.sessionStorage.setItem).toHaveBeenCalled();

    act(() => {
      result.current.clearUrls();
    });

    expect(window.sessionStorage.removeItem).toHaveBeenCalled();
    expect(result.current.fullShareableUrl).toBe('');
  });

  it('copies URL to clipboard and sets copied flag', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const { result } = renderHook(() =>
      useShareableUrl({ initialShareableUrl: '/xray?assets=123' }),
    );

    await act(async () => {
      const success = await result.current.copyToClipboard();
      expect(success).toBe(true);
    });

    expect(writeText).toHaveBeenCalledWith(
      'https://example.com/xray?assets=123',
    );
    expect(result.current.copied).toBe(true);
  });

  it('opens Morningstar PDF in new tab when morningstarUrl is set', () => {
    const { result } = renderHook(() =>
      useShareableUrl({ initialMorningstarUrl: 'https://ms.com/pdf' }),
    );

    act(() => {
      result.current.openMorningstarPdf();
    });

    expect(window.open).toHaveBeenCalledWith('https://ms.com/pdf', '_blank');
  });
});

