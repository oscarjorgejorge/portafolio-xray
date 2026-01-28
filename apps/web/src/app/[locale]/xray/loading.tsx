import { Spinner } from '@/components/ui/Spinner';

/**
 * Next.js loading component for X-Ray generation route.
 * Shows a centered spinner with message while the page loads.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
        <div className="text-center py-12">
          <Spinner size="lg" className="text-blue-500 mx-auto mb-4" />
          <p className="text-slate-700">Loading X-Ray...</p>
        </div>
      </div>
    </main>
  );
}
