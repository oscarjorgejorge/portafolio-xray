import { PortfolioBuilderSkeleton, Skeleton } from '@/components/ui/Skeleton';

/**
 * Next.js loading component for [locale] route.
 * Shown automatically during page transitions and initial load.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
        <div className="mb-8">
          {/* Title skeleton */}
          <Skeleton className="w-80 mb-2" height="xl" />
          {/* Subtitle skeleton */}
          <Skeleton className="w-full max-w-xl" height="md" />
        </div>

        <PortfolioBuilderSkeleton assetCount={2} />
      </div>
    </main>
  );
}
