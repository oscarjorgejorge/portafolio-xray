'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface XRayIssueHintProps {
  className?: string;
}

/**
 * Quiet recovery path when an X-Ray is incomplete.
 * Kept as a footnote (not a second search helper) so it does not compete with the add-asset flow.
 */
export function XRayIssueHint({ className }: XRayIssueHintProps) {
  const t = useTranslations('portfolio');

  return (
    <p
      className={cn(
        'text-xs text-slate-500 leading-relaxed',
        className,
      )}
    >
      {t.rich('xrayIssueHint', {
        contactLink: (chunks) => (
          <Link
            href="/contact"
            className="font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
          >
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
