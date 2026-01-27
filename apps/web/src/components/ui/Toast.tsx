'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert } from './Alert';
import { CloseIcon } from './Icons';

interface ToastProps {
  message: string;
  variant?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
  /** Whether to show the close button (default: true) */
  showCloseButton?: boolean;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  variant = 'info',
  duration = 3000,
  onClose,
  showCloseButton = true,
}) => {
  const [mounted, setMounted] = useState(false);

  // Only render portal after component mounts (client-side only)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  // Determine aria-live based on variant
  // 'assertive' for errors (important), 'polite' for others
  const ariaLive = variant === 'error' ? 'assertive' : 'polite';

  const toastContent = (
    <div
      className="fixed top-4 right-4 z-50 animate-slide-in"
      role="status"
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <Alert variant={variant} className="min-w-[300px] shadow-lg pr-10 relative">
        <span className="pr-2">{message}</span>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-1/2 right-3 -translate-y-1/2 p-1 rounded-full hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current transition-colors"
            aria-label="Dismiss notification"
            type="button"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </Alert>
    </div>
  );

  // Don't render anything if not mounted (SSR safety)
  if (!mounted) return null;

  // Render toast at document body level using portal
  return createPortal(toastContent, document.body);
};

/**
 * Toast item props for ToastContainer (without portal behavior)
 */
interface ToastItemProps {
  message: string;
  variant?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
  showCloseButton?: boolean;
}

/**
 * Internal toast item component without portal (used inside ToastContainer)
 */
const ToastItem: React.FC<ToastItemProps> = ({
  message,
  variant = 'info',
  duration = 3000,
  onClose,
  showCloseButton = true,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const ariaLive = variant === 'error' ? 'assertive' : 'polite';

  return (
    <div
      className="animate-slide-in"
      role="status"
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <Alert variant={variant} className="min-w-[300px] shadow-lg pr-10 relative">
        <span className="pr-2">{message}</span>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-1/2 right-3 -translate-y-1/2 p-1 rounded-full hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-current transition-colors"
            aria-label="Dismiss notification"
            type="button"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </Alert>
    </div>
  );
};

/**
 * Toast container component for managing multiple toasts.
 * Uses portal to render at document body level.
 */
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    variant?: 'success' | 'error' | 'info';
    duration?: number;
  }>;
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemove,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || toasts.length === 0) return null;

  const containerContent = (
    <div
      className="fixed top-4 right-4 z-50 space-y-2"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={toast.duration}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );

  return createPortal(containerContent, document.body);
};
