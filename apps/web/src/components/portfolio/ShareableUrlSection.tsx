'use client';

import React, { memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/** Copy button visual state */
type CopyState = 'idle' | 'copied' | 'error';

interface ShareableUrlSectionProps {
  fullShareableUrl: string;
  morningstarUrl: string | null;
  copied: boolean;
  copyError?: boolean;
  onCopyUrl: () => void;
  onOpenPDF: () => void;
}

/**
 * Displays shareable URL and X-Ray report link after successful generation.
 */
export const ShareableUrlSection = memo<ShareableUrlSectionProps>(function ShareableUrlSection({
  fullShareableUrl,
  morningstarUrl,
  copied,
  copyError = false,
  onCopyUrl,
  onOpenPDF,
}) {
  const t = useTranslations('shareable');
  const tCommon = useTranslations('common');
  
  // Derive copy state from boolean flags
  const copyState: CopyState = useMemo(() => {
    if (copied) return 'copied';
    if (copyError) return 'error';
    return 'idle';
  }, [copied, copyError]);

  const copyButtonText = {
    idle: tCommon('copy'),
    copied: tCommon('copied'),
    error: tCommon('failed'),
  }[copyState];

  const copyButtonVariant = copyState === 'error' ? 'danger' : 'secondary';

  return (
    <div className="pt-4 border-t border-border">
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground">
            {t('title')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={fullShareableUrl}
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
              aria-label="Shareable portfolio URL"
            />
            <Button
              onClick={onCopyUrl}
              variant={copyButtonVariant}
              size="sm"
              aria-live="polite"
            >
              {copyButtonText}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button
          onClick={onOpenPDF}
          className="w-full"
          disabled={!morningstarUrl}
        >
          {t('viewReport')}
        </Button>
      </div>
    </div>
  );
});
