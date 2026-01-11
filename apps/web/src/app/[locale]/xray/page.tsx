'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { generateXRay } from '@/lib/api/xray';
import { useMutation } from '@tanstack/react-query';

function XRayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [morningstarUrl, setMorningstarUrl] = useState<string | null>(null);
  const [shareableUrl, setShareableUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fullShareableUrl, setFullShareableUrl] = useState<string>('');

  const generateMutation = useMutation({
    mutationFn: generateXRay,
    onSuccess: (data) => {
      setMorningstarUrl(data.morningstarUrl);
      setShareableUrl(data.shareableUrl);
      // Set full URL on client side only
      if (typeof window !== 'undefined') {
        setFullShareableUrl(`${window.location.origin}${data.shareableUrl}`);
      }
    },
  });

  // Update full URL when shareableUrl changes (client-side only)
  useEffect(() => {
    if (shareableUrl && typeof window !== 'undefined') {
      setFullShareableUrl(`${window.location.origin}${shareableUrl}`);
    }
  }, [shareableUrl]);

  useEffect(() => {
    // Parse assets from URL and generate X-Ray
    const assetsParam = searchParams.get('assets');
    if (assetsParam) {
      const parseAssets = () => {
        try {
          const decoded = decodeURIComponent(assetsParam);
          const pairs = decoded.split(',');
          const assets = pairs
            .map((pair) => {
              const [morningstarId, weightStr] = pair.split(':');
              const weight = parseFloat(weightStr);
              if (morningstarId && !isNaN(weight)) {
                return { morningstarId, weight };
              }
              return null;
            })
            .filter((asset): asset is { morningstarId: string; weight: number } => asset !== null);

          if (assets.length > 0) {
            generateMutation.mutate(assets);
          }
        } catch (error) {
          console.error('Error parsing assets:', error);
        }
      };

      parseAssets();
    }
  }, [searchParams]);

  const handleCopyUrl = (url: string, type: 'morningstar' | 'shareable') => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenPDF = () => {
    if (morningstarUrl) {
      window.open(morningstarUrl, '_blank');
    }
  };

  if (generateMutation.isPending) {
    return (
      <main className="min-h-screen bg-slate-100 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-700">Generating X-Ray URL...</p>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (generateMutation.isError) {
    return (
      <main className="min-h-screen bg-slate-100 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
          <Card>
            <Alert variant="error">
              <p className="font-medium">Error generating X-Ray</p>
              <p className="text-sm mt-1">
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : 'An unexpected error occurred'}
              </p>
            </Alert>
            <div className="mt-4">
              <Button onClick={() => router.push('/')} variant="secondary">
                Back to Portfolio Builder
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (!morningstarUrl || !shareableUrl) {
    return (
      <main className="min-h-screen bg-slate-100 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
          <Card>
            <Alert variant="warning">
              <p>No portfolio data found in URL.</p>
            </Alert>
            <div className="mt-4">
              <Button onClick={() => router.push('/')} variant="secondary">
                Back to Portfolio Builder
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  // Ensure fullShareableUrl is set if not already set
  const displayShareableUrl = fullShareableUrl || (shareableUrl ? shareableUrl : '');

  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            X-Ray Generated
          </h1>
          <p className="text-slate-700">
            Your Morningstar X-Ray report is ready. Open the PDF or share the
            link with others.
          </p>
        </div>

        <div className="space-y-6">
          <Card title="Morningstar X-Ray PDF">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Morningstar URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={morningstarUrl}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                  />
                  <Button
                    onClick={() => handleCopyUrl(morningstarUrl, 'morningstar')}
                    variant="secondary"
                    size="sm"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              <Button onClick={handleOpenPDF} className="w-full">
                Open X-Ray PDF
              </Button>
            </div>
          </Card>

          <Card title="Shareable Link">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Share this link to recreate the portfolio
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={displayShareableUrl}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                  />
                  <Button
                    onClick={() => handleCopyUrl(displayShareableUrl, 'shareable')}
                    variant="secondary"
                    size="sm"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex justify-center">
            <Button
              onClick={() => router.push('/')}
              variant="secondary"
            >
              Create New Portfolio
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function XRayPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-100 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
          <Card>
            <div className="text-center py-12">
              <p className="text-slate-700">Loading...</p>
            </div>
          </Card>
        </div>
      </main>
    }>
      <XRayPageContent />
    </Suspense>
  );
}

