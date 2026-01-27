'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  /** Width class (e.g., 'w-full', 'w-24') */
  className?: string;
  /** Height preset */
  height?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show rounded corners */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  /** Whether to animate the skeleton */
  animate?: boolean;
}

const heightClasses = {
  xs: 'h-3',
  sm: 'h-4',
  md: 'h-6',
  lg: 'h-10',
  xl: 'h-16',
};

const roundedClasses = {
  none: 'rounded-none',
  sm: 'rounded',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

/**
 * Skeleton component for loading placeholders.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  height = 'md',
  rounded = 'md',
  animate = true,
}) => {
  return (
    <div
      className={cn(
        'bg-slate-200',
        heightClasses[height],
        roundedClasses[rounded],
        animate && 'animate-pulse',
        className
      )}
      aria-hidden="true"
    />
  );
};

/**
 * Pre-built skeleton for asset row loading state.
 */
export const AssetRowSkeleton: React.FC = () => {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0 pr-2">
          {/* Name skeleton */}
          <Skeleton className="w-3/4 mb-2" height="md" />
          {/* Meta info skeleton */}
          <div className="flex items-center gap-4 mt-1">
            <Skeleton className="w-12" height="sm" />
            <Skeleton className="w-20" height="sm" />
            <Skeleton className="w-24" height="sm" />
          </div>
        </div>
        {/* Weight input skeleton */}
        <div className="hidden md:block">
          <Skeleton className="w-24" height="lg" />
        </div>
        {/* Remove button skeleton */}
        <Skeleton className="w-8 h-8" rounded="lg" />
      </div>
      {/* Mobile weight input skeleton */}
      <div className="md:hidden mt-2">
        <Skeleton className="w-full" height="lg" />
      </div>
    </div>
  );
};

/**
 * Pre-built skeleton for card loading state.
 */
export const CardSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-6">
      {/* Title skeleton */}
      <Skeleton className="w-1/3 mb-4" height="lg" />
      {/* Content lines skeleton */}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={i === lines - 1 ? 'w-2/3' : 'w-full'}
            height="sm"
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Pre-built skeleton for page loading state.
 */
export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <Skeleton className="w-1/2 mb-2" height="xl" />
        <Skeleton className="w-3/4" height="md" />
      </div>
      {/* Card skeleton */}
      <CardSkeleton lines={4} />
      {/* Asset rows skeleton */}
      <div className="space-y-4">
        <AssetRowSkeleton />
        <AssetRowSkeleton />
      </div>
    </div>
  );
};
