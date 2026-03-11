import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // List of supported locales
  locales: ['es', 'en'],
  
  // Spanish as the default locale
  defaultLocale: 'es',
  
  // Always show locale prefix in URL (e.g., /es/..., /en/...)
  localePrefix: 'always'
});

export type Locale = (typeof routing.locales)[number];
