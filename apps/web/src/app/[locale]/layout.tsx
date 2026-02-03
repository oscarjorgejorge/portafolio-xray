import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { QueryProvider } from '@/providers/QueryProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { inter } from '../layout';

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: {
      default: t('title'),
      template: `%s | ${t('title')}`,
    },
    description: t('description'),
    keywords: [
      'portfolio analysis',
      'Morningstar X-Ray',
      'investment analysis',
      'ETF analysis',
      'fund analysis',
      'asset allocation',
      'portfolio tracker',
      'ISIN lookup',
    ],
    authors: [{ name: 'Portfolio X-Ray Team' }],
    openGraph: {
      type: 'website',
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      siteName: t('title'),
      title: t('title'),
      description: t('description'),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      languages: {
        en: '/en',
        es: '/es',
      },
    },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Validate locale
  if (!routing.locales.includes(locale as typeof routing.locales[number])) {
    notFound();
  }

  // Load messages for the current locale
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <ErrorBoundary>
              {/* Language Switcher - Fixed position in top right */}
              <div className="fixed top-4 right-4 z-50">
                <LanguageSwitcher />
              </div>
              {children}
            </ErrorBoundary>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
