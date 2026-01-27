'use client';

import { useState, useEffect, useCallback } from 'react';

const COPY_FEEDBACK_DURATION_MS = 2000;

interface UseShareableUrlOptions {
  /** Initial shareable URL path (without origin) */
  initialShareableUrl?: string | null;
  /** Initial Morningstar URL */
  initialMorningstarUrl?: string | null;
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
  /** Set shareable URL path */
  setShareableUrl: (url: string | null) => void;
  /** Set Morningstar URL */
  setMorningstarUrl: (url: string | null) => void;
  /** Set both URLs at once */
  setUrls: (shareableUrl: string | null, morningstarUrl: string | null) => void;
  /** Copy URL to clipboard */
  copyToClipboard: (url?: string) => Promise<void>;
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
}: UseShareableUrlOptions = {}): UseShareableUrlReturn {
  const [shareableUrl, setShareableUrl] = useState<string | null>(initialShareableUrl);
  const [morningstarUrl, setMorningstarUrl] = useState<string | null>(initialMorningstarUrl);
  const [fullShareableUrl, setFullShareableUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Build full URL when shareableUrl changes (client-side only)
  useEffect(() => {
    if (shareableUrl && typeof window !== 'undefined') {
      setFullShareableUrl(`${window.location.origin}${shareableUrl}`);
    } else {
      setFullShareableUrl('');
    }
  }, [shareableUrl]);

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
    async (url?: string) => {
      const urlToCopy = url || fullShareableUrl;
      if (!urlToCopy) return;

      try {
        await navigator.clipboard.writeText(urlToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION_MS);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    },
    [fullShareableUrl]
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
  }, []);

  return {
    shareableUrl,
    fullShareableUrl,
    morningstarUrl,
    copied,
    setShareableUrl,
    setMorningstarUrl,
    setUrls,
    copyToClipboard,
    openMorningstarPdf,
    clearUrls,
  };
}
