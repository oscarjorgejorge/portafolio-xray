'use client';

import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { unmappedInstantXrayFallbackCount } from '@/lib/utils';

interface XRayGenerateHintsProps {
  unsupportedCount: number;
  holdingsUsingFallback: number;
  holdingsUsingRelatedShareClass?: number;
  namespace?: 'portfolio' | 'xray';
  className?: string;
}

export function XRayGenerateHints({
  unsupportedCount,
  holdingsUsingFallback,
  holdingsUsingRelatedShareClass = 0,
  namespace = 'portfolio',
  className,
}: XRayGenerateHintsProps) {
  const t = useTranslations(namespace);
  const unmappedCount = unmappedInstantXrayFallbackCount(
    holdingsUsingFallback,
    unsupportedCount,
  );

  if (
    unsupportedCount <= 0 &&
    unmappedCount <= 0 &&
    holdingsUsingRelatedShareClass <= 0
  ) {
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
        <Alert
          variant="info"
          className={unsupportedCount > 0 ? 'mt-3' : undefined}
        >
          {t('unmappedHint', { count: unmappedCount })}
        </Alert>
      )}
      {holdingsUsingRelatedShareClass > 0 && (
        <Alert
          variant="info"
          className={
            unsupportedCount > 0 || unmappedCount > 0 ? 'mt-3' : undefined
          }
        >
          {t('relatedShareClassHint', {
            count: holdingsUsingRelatedShareClass,
          })}
        </Alert>
      )}
    </div>
  );
}
