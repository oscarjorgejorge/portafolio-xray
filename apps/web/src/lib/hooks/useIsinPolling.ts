'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getAssetById, Asset } from '@/lib/api/assets';

interface UseIsinPollingOptions {
  /** Asset ID to poll */
  assetId: string | undefined;
  /** Whether ISIN enrichment is pending */
  isinPending: boolean;
  /** Callback when asset is updated with ISIN */
  onIsinResolved: (asset: Asset) => void;
  /** Polling interval in ms (default: 5000) */
  interval?: number;
  /** Maximum number of polling attempts (default: 6 = 30s) */
  maxAttempts?: number;
}

/**
 * Hook to poll for ISIN enrichment completion
 * Polls the API every `interval` ms until ISIN is resolved or max attempts reached
 */
export function useIsinPolling({
  assetId,
  isinPending,
  onIsinResolved,
  interval = 5000,
  maxAttempts = 6,
}: UseIsinPollingOptions): { isPolling: boolean } {
  const attemptCountRef = useRef(0);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    isPollingRef.current = false;
    attemptCountRef.current = 0;
  }, []);

  const pollForIsin = useCallback(async () => {
    if (!assetId) return;

    attemptCountRef.current += 1;

    try {
      const updatedAsset = await getAssetById(assetId);

      // Check if ISIN is now available or enrichment is complete
      if (updatedAsset.isin || !updatedAsset.isinPending) {
        stopPolling();
        onIsinResolved(updatedAsset);
        return;
      }

      // Check if we've reached max attempts
      if (attemptCountRef.current >= maxAttempts) {
        stopPolling();
        // Still notify with the current state
        onIsinResolved(updatedAsset);
      }
    } catch (error) {
      console.error('Error polling for ISIN:', error);
      // Stop polling on error
      stopPolling();
    }
  }, [assetId, maxAttempts, onIsinResolved, stopPolling]);

  useEffect(() => {
    // Start polling if ISIN is pending and we have an asset ID
    if (isinPending && assetId && !isPollingRef.current) {
      isPollingRef.current = true;
      attemptCountRef.current = 0;

      // Start polling
      intervalIdRef.current = setInterval(pollForIsin, interval);

      // Also do an immediate first poll after a short delay
      const timeoutId = setTimeout(pollForIsin, 1000);

      return () => {
        clearTimeout(timeoutId);
        stopPolling();
      };
    }

    // Stop polling if ISIN is no longer pending
    if (!isinPending && isPollingRef.current) {
      stopPolling();
    }
  }, [isinPending, assetId, interval, pollForIsin, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return { isPolling: isPollingRef.current };
}
