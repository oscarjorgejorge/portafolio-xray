'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

/**
 * Client component to update the html lang attribute dynamically
 * This is needed because the root layout is server-side and doesn't have access to locale
 */
export function HtmlLangUpdater() {
  const locale = useLocale();

  useEffect(() => {
    // Update the html lang attribute when locale changes
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return null;
}
