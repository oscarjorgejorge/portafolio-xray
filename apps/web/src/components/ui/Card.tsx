import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, title, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-white rounded-lg shadow-lg border border-slate-200 p-6',
          className
        )}
        {...props}
      >
        {title && (
          <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

