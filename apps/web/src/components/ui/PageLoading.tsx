import React from 'react';
import { Spinner } from './Spinner';

interface PageLoadingProps {
  /** Loading message to display */
  message?: string;
  /** Whether to show the spinner icon */
  showSpinner?: boolean;
}

/**
 * Full-page loading component for use as Suspense fallback or loading state
 */
export const PageLoading: React.FC<PageLoadingProps> = ({
  message = 'Loading...',
  showSpinner = true,
}) => {
  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
        <div className="text-center py-12">
          {showSpinner && (
            <Spinner size="lg" className="text-blue-500 mx-auto mb-4" />
          )}
          <p className="text-slate-700">{message}</p>
        </div>
      </div>
    </main>
  );
};
