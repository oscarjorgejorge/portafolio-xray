'use client';

import { useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { PageLoading } from '@/components/ui/PageLoading';
import { generateXRay } from '@/lib/api/xray';
import { useMutation } from '@tanstack/react-query';
import { useShareableUrl } from '@/lib/hooks/useShareableUrl';
import { captureException } from '@/lib/services/errorReporting';

function XRayPageContent() {
  const t = useTranslations('xray');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasGeneratedRef = useRef(false);

  const {
    morningstarUrl,
    fullShareableUrl,
    copied,
    setUrls,
    copyToClipboard,
    openMorningstarPdf,
  } = useShareableUrl();

  const generateMutation = useMutation({
    mutationFn: generateXRay,
    onSuccess: (data) => {
      setUrls(data.shareableUrl, data.morningstarUrl);
    },
  });

  // Extract mutate function - it's stable and won't cause re-renders
  const { mutate } = generateMutation;

  useEffect(() => {
    // Prevent re-execution if already generated
    if (hasGeneratedRef.current) {
      return;
    }

    // Parse assets from URL and generate X-Ray
    const assetsParam = searchParams.get('assets');
    if (assetsParam) {
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
          hasGeneratedRef.current = true;
          mutate(assets);
        }
      } catch (error) {
        captureException(error instanceof Error ? error : new Error('Failed to parse assets from URL'), {
          tags: { action: 'xray-url-parse' },
        });
      }
    }
  }, [searchParams, mutate]);

  if (generateMutation.isPending) {
    return <PageLoading message={t('generating')} />;
  }

  if (generateMutation.isError) {
    return (
      <main className="min-h-screen bg-slate-100 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
          <Card>
            <Alert variant="error">
              <p className="font-medium">{t('error')}</p>
              <p className="text-sm mt-1">
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : t('unexpectedError')}
              </p>
            </Alert>
            <div className="mt-4">
              <Button onClick={() => router.push('/')} variant="secondary">
                {t('backToBuilder')}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (!morningstarUrl || !fullShareableUrl) {
    return (
      <main className="min-h-screen bg-slate-100 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl">
          <Card>
            <Alert variant="warning">
              <p>{t('noPortfolioData')}</p>
            </Alert>
            <div className="mt-4">
              <Button onClick={() => router.push('/')} variant="secondary">
                {t('backToBuilder')}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {t('title')}
          </h1>
          <p className="text-slate-700">
            {t('subtitle')}
          </p>
        </div>

        <div className="space-y-6">
          <Card title={t('pdfCard.title')}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('pdfCard.urlLabel')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={morningstarUrl}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                  />
                  <Button
                    onClick={() => copyToClipboard(morningstarUrl)}
                    variant="secondary"
                    size="sm"
                  >
                    {copied ? tCommon('copied') : tCommon('copy')}
                  </Button>
                </div>
              </div>
              <Button onClick={openMorningstarPdf} className="w-full">
                {t('pdfCard.openPdf')}
              </Button>
            </div>
          </Card>

          <Card title={t('shareCard.title')}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('shareCard.description')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={fullShareableUrl}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                  />
                  <Button
                    onClick={() => copyToClipboard()}
                    variant="secondary"
                    size="sm"
                  >
                    {copied ? tCommon('copied') : tCommon('copy')}
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
              {t('createNew')}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function XRayPage() {
  const tCommon = useTranslations('common');
  
  return (
    <Suspense fallback={<PageLoading message={tCommon('loading')} />}>
      <XRayPageContent />
    </Suspense>
  );
}
