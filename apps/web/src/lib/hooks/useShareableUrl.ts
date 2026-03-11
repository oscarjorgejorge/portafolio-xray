'use client';

import { useState, useEffect, useCallback } from 'react';
import { UI_FEEDBACK } from '@/lib/constants';
import { captureException } from '@/lib/services/errorReporting';

const SHAREABLE_URL_STORAGE_KEY = 'shareableUrlState';

interface UseShareableUrlOptions {
  /** Initial shareable URL path (without origin) */
  initialShareableUrl?: string | null;
  /** Initial Morningstar URL */
  initialMorningstarUrl?: string | null;
  /** Callback when copy fails */
  onCopyError?: (error: Error) => void;
}

interface UseShareableUrlReturn {
  /** Shareable URL path (without origin) */
  shareableUrl: string | null;
  /** Full shareable URL (with origin) */
  fullShareableUrl: string;
  /** Morningstar X-Ray URL */
  morningstarUrl: string | null;
  /** Whether the URL was recently copied */
  copied: boolean;
  /** Whether a copy error occurred recently */
  copyError: boolean;
  /** Set shareable URL path */
  setShareableUrl: (url: string | null) => void;
  /** Set Morningstar URL */
  setMorningstarUrl: (url: string | null) => void;
  /** Set both URLs at once */
  setUrls: (shareableUrl: string | null, morningstarUrl: string | null) => void;
  /** Copy URL to clipboard - returns true if successful */
  copyToClipboard: (url?: string) => Promise<boolean>;
  /** Open Morningstar PDF in new tab */
  openMorningstarPdf: () => void;
  /** Clear all URLs */
  clearUrls: () => void;
}

/**
 * Hook to manage shareable URL state and clipboard operations.
 * Centralizes the logic for building full URLs and copy feedback.
 */
export function useShareableUrl({
  initialShareableUrl = null,
  initialMorningstarUrl = null,
  onCopyError,
}: UseShareableUrlOptions = {}): UseShareableUrlReturn {
  const [shareableUrl, setShareableUrl] = useState<string | null>(
    initialShareableUrl
  );
  const [morningstarUrl, setMorningstarUrl] = useState<string | null>(
    initialMorningstarUrl
  );
  const [fullShareableUrl, setFullShareableUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.sessionStorage.getItem(SHAREABLE_URL_STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as {
        shareableUrl?: string | null;
        morningstarUrl?: string | null;
      };

      if (parsed.shareableUrl || parsed.morningstarUrl) {
        setShareableUrl(parsed.shareableUrl ?? null);
        setMorningstarUrl(parsed.morningstarUrl ?? null);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Build full URL when shareableUrl changes (client-side only)
  useEffect(() => {
    if (shareableUrl && typeof window !== 'undefined') {
      setFullShareableUrl(`${window.location.origin}${shareableUrl}`);
    } else {
      setFullShareableUrl('');
    }
  }, [shareableUrl]);

  // Persist URLs in sessionStorage so they survive redirects within the session
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!shareableUrl && !morningstarUrl) {
      window.sessionStorage.removeItem(SHAREABLE_URL_STORAGE_KEY);
      return;
    }

    try {
      window.sessionStorage.setItem(
        SHAREABLE_URL_STORAGE_KEY,
        JSON.stringify({
          shareableUrl,
          morningstarUrl,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [shareableUrl, morningstarUrl]);

  // Set both URLs at once
  const setUrls = useCallback(
    (newShareableUrl: string | null, newMorningstarUrl: string | null) => {
      setShareableUrl(newShareableUrl);
      setMorningstarUrl(newMorningstarUrl);
    },
    []
  );

  // Copy URL to clipboard with feedback
  const copyToClipboard = useCallback(
    async (url?: string): Promise<boolean> => {
      const urlToCopy = url || fullShareableUrl;
      if (!urlToCopy) return false;

      try {
        await navigator.clipboard.writeText(urlToCopy);
        setCopied(true);
        setCopyError(false);
        setTimeout(() => setCopied(false), UI_FEEDBACK.COPY_FEEDBACK_DURATION_MS);
        return true;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to copy to clipboard');
        captureException(err, { tags: { action: 'clipboard-copy' } });
        setCopyError(true);
        setCopied(false);
        setTimeout(
          () => setCopyError(false),
          UI_FEEDBACK.COPY_FEEDBACK_DURATION_MS
        );

        // Call error callback if provided
        onCopyError?.(err);

        // Fallback: try to use execCommand (deprecated but works in more contexts)
        try {
          const textArea = document.createElement('textarea');
          textArea.value = urlToCopy;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);

          if (successful) {
            setCopied(true);
            setCopyError(false);
            setTimeout(
              () => setCopied(false),
              UI_FEEDBACK.COPY_FEEDBACK_DURATION_MS
            );
            return true;
          }
        } catch {
          // Fallback also failed
        }

        return false;
      }
    },
    [fullShareableUrl, onCopyError]
  );

  // Open Morningstar PDF in new tab
  const openMorningstarPdf = useCallback(() => {
    if (morningstarUrl) {
      window.open(morningstarUrl, '_blank');
    }
  }, [morningstarUrl]);

  // Clear all URLs
  const clearUrls = useCallback(() => {
    setShareableUrl(null);
    setMorningstarUrl(null);
    setFullShareableUrl('');
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SHAREABLE_URL_STORAGE_KEY);
    }
  }, []);

  return {
    shareableUrl,
    fullShareableUrl,
    morningstarUrl,
    copied,
    copyError,
    setShareableUrl,
    setMorningstarUrl,
    setUrls,
    copyToClipboard,
    openMorningstarPdf,
    clearUrls,
  };
}
