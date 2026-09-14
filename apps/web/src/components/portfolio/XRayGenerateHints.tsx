'use client';

import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { unmappedInstantXrayFallbackCount } from '@/lib/utils';

interface XRayGenerateHintsProps {
  unsupportedCount: number;
  holdingsUsingFallback: number;
  namespace?: 'portfolio' | 'xray';
  className?: string;
}

export function XRayGenerateHints({
  unsupportedCount,
  holdingsUsingFallback,
  namespace = 'portfolio',
  className,
}: XRayGenerateHintsProps) {
  const t = useTranslations(namespace);
  const unmappedCount = unmappedInstantXrayFallbackCount(
    holdingsUsingFallback,
    unsupportedCount,
  );

  if (unsupportedCount <= 0 && unmappedCount <= 0) {
    return null;
  }

  return (
    <div className={className}>
      {unsupportedCount > 0 && (
        <Alert variant="warning">
          {t('unsupportedHint', { count: unsupportedCount })}
        </Alert>
      )}
      {unmappedCount > 0 && (
        <Alert variant="info" className={unsupportedCount > 0 ? 'mt-3' : undefined}>
          {t('unmappedHint', { count: unmappedCount })}
        </Alert>
      )}
    </div>
  );
}
