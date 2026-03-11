'use client';

import React, { memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/** Copy button visual state */
type CopyState = 'idle' | 'copied' | 'error';

interface ShareableUrlSectionProps {
  fullShareableUrl: string;
  morningstarUrl: string | null;
  /** Whether the portfolio is public (controls share availability) */
  isPublic: boolean;
  copied: boolean;
  copyError?: boolean;
  onCopyUrl: () => void;
  onSavePortfolio?: () => void;
  onOpenPDF: () => void;
}

/**
 * Displays shareable URL and X-Ray report link after successful generation.
 */
export const ShareableUrlSection = memo<ShareableUrlSectionProps>(function ShareableUrlSection({
  fullShareableUrl,
  morningstarUrl,
  isPublic,
  copied,
  copyError = false,
  onCopyUrl,
  onSavePortfolio,
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
  const isShareDisabled = !isPublic;

  return (
    <div className="mt-3 pt-4 border-t border-border">
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
              disabled={isShareDisabled}
              aria-live="polite"
            >
              {copyButtonText}
            </Button>
            {onSavePortfolio && (
              <Button onClick={onSavePortfolio} variant="secondary" size="sm">
                {tCommon('save')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('description')}
          </p>
          {isShareDisabled && (
            <p className="text-xs text-amber-600 mt-1">
              {t('privateHint')}
            </p>
          )}
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
