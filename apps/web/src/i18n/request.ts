import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // Get the locale from the request (from URL like /es or /en)
  let locale = await requestLocale;

  // Validate that the locale is supported, fallback to default if not
  if (!locale || !routing.locales.includes(locale as typeof routing.locales[number])) {
    locale = routing.defaultLocale;
  }

  // Dynamically load and return the translation messages for this locale
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
