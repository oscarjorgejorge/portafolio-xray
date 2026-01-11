'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PortfolioBuilder } from '@/components/portfolio/PortfolioBuilder';
import type { PortfolioAsset } from '@/types';
import { resolveAsset } from '@/lib/api/assets';

function HomePageContent() {
  const searchParams = useSearchParams();
  const [initialAssets, setInitialAssets] = useState<PortfolioAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Parse shareable URL if assets param exists
    const assetsParam = searchParams.get('assets');
    if (assetsParam) {
      setIsLoading(true);
      const parseAndResolveAssets = async () => {
        try {
          const decodedAssetsParam = decodeURIComponent(assetsParam);
          const pairs = decodedAssetsParam.split(',');
          const resolvedAssets: PortfolioAsset[] = [];

          for (const pair of pairs) {
            const [identifier, weightStr] = pair.split(':');
            const weight = parseFloat(weightStr) || 0;

            if (identifier && !isNaN(weight)) {
              try {
                const result = await resolveAsset(identifier);
                if (result.success && result.asset) {
                  resolvedAssets.push({
                    id: Math.random().toString(36).substr(2, 9),
                    identifier: identifier.toUpperCase(),
                    asset: result.asset,
                    weight,
                    status: 'resolved',
                  });
                } else {
                  // If resolution fails, add as pending
                  resolvedAssets.push({
                    id: Math.random().toString(36).substr(2, 9),
                    identifier: identifier.toUpperCase(),
                    weight,
                    status: 'error',
                    error: result.error || 'Could not resolve asset',
                  });
                }
              } catch (error) {
                resolvedAssets.push({
                  id: Math.random().toString(36).substr(2, 9),
                  identifier: identifier.toUpperCase(),
                  weight,
                  status: 'error',
                  error: 'Failed to resolve asset',
                });
              }
            }
          }

          setInitialAssets(resolvedAssets);
        } catch (error) {
          console.error('Error parsing shareable URL:', error);
        } finally {
          setIsLoading(false);
        }
      };

      parseAndResolveAssets();
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Portfolio X-Ray Generator
          </h1>
          <p className="text-gray-600">
            Generate Morningstar X-Ray reports for your portfolio. Enter ISINs
            or Morningstar IDs and get instant analysis.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading portfolio...</p>
          </div>
        ) : (
          <PortfolioBuilder initialAssets={initialAssets} />
        )}
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </main>
    }>
      <HomePageContent />
    </Suspense>
  );
}

