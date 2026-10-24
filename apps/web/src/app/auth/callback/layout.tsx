import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { noIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = noIndexMetadata;

/**
 * Lives outside [locale], so it renders its own <html> (the root layout has none).
 */
export default function AuthCallbackLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang={routing.defaultLocale}>
      <body>{children}</body>
    </html>
  );
}
