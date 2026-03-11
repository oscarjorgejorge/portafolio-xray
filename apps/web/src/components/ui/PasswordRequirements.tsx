'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface PasswordRequirementsProps {
  password: string;
  minLength?: number;
  className?: string;
}

export function PasswordRequirements({
  password,
  minLength = 6,
  className,
}: PasswordRequirementsProps) {
  const t = useTranslations('password');
  const hasMinLength = password.length >= minLength;

  return (
    <div
      className={cn(
        'mt-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur-sm',
        className,
      )}
    >
      <p className="mb-1 font-medium text-slate-700">
        {t('title')}
      </p>
      <ul className="space-y-1">
        <li className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded-full border text-[10px]',
              hasMinLength
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 bg-white text-slate-400',
            )}
          >
            ✓
          </span>
          <span className={hasMinLength ? 'text-slate-700' : undefined}>
            {t('minLength', { length: minLength })}
          </span>
        </li>
      </ul>
    </div>
  );
}

