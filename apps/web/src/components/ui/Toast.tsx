'use client';

import React, { useEffect } from 'react';
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

  return (
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
};

// Toast container component for managing multiple toasts
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
  return (
    <div
      className="fixed top-4 right-4 z-50 space-y-2"
      aria-label="Notifications"
    >
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ marginTop: index > 0 ? '0.5rem' : 0 }}
        >
          <Toast
            message={toast.message}
            variant={toast.variant}
            duration={toast.duration}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};
