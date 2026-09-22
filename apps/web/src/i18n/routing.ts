import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // List of supported locales
  locales: ['es', 'en'],
  
  // Spanish as the default locale
  defaultLocale: 'es',
  
  // Always show locale prefix in URL (e.g., /es/..., /en/...)
  localePrefix: 'always',

  // Unprefixed URLs always 308 to /es in middleware, not the browser language.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
