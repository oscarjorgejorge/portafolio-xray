'use client';

import React, { useEffect, useState } from 'react';

interface ScreenReaderAnnounceProps {
  /** Message to announce to screen readers */
  message: string;
  /** Politeness level: 'polite' waits for idle, 'assertive' interrupts */
  politeness?: 'polite' | 'assertive';
  /** Unique key to force re-announcement of the same message */
  announceKey?: string | number;
}

/**
 * Component that announces messages to screen readers.
 * Visually hidden but accessible to assistive technologies.
 *
 * Usage:
 * - Use 'polite' (default) for non-urgent updates
 * - Use 'assertive' for critical updates that need immediate attention
 * - Change announceKey to force re-announcement of the same message
 */
export function ScreenReaderAnnounce({
  message,
  politeness = 'polite',
  announceKey,
}: ScreenReaderAnnounceProps) {
  const [announcement, setAnnouncement] = useState('');

  // Reset and set message to trigger announcement
  useEffect(() => {
    if (message) {
      // Clear first to ensure re-announcement of identical messages
      setAnnouncement('');
      // Use requestAnimationFrame to ensure the clear happens first
      requestAnimationFrame(() => {
        setAnnouncement(message);
      });
    }
  }, [message, announceKey]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

/**
 * Hook to manage screen reader announcements.
 * Returns a function to trigger announcements.
 */
export function useScreenReaderAnnounce() {
  const [announcement, setAnnouncement] = useState<{
    message: string;
    key: number;
  }>({ message: '', key: 0 });

  const announce = (message: string) => {
    setAnnouncement((prev) => ({ message, key: prev.key + 1 }));
  };

  return {
    announce,
    message: announcement.message,
    announceKey: announcement.key,
  };
}
