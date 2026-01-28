import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'success' | 'error' | 'warning' | 'info';
}

const variantStyles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ children, variant = 'info', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('border rounded-lg p-4', variantStyles[variant], className)}
        role="alert"
        {...props}
      >
        {children}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

