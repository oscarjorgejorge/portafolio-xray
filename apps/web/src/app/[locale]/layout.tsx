import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { NavBar } from '@/components/navigation/NavBar';
import { MainWithSidebar } from '@/components/layout/MainWithSidebar';
import { BottomNav } from '@/components/navigation/BottomNav';
import { AuthModalProvider } from '@/lib/auth/AuthModalContext';
import { BRAND_NAME, getSiteUrl } from '@/lib/seo';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/lib/auth';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

// Only /es and /en exist; any other first segment is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: t('title'),
      template: `%s | ${BRAND_NAME}`,
    },
    description: t('description'),
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
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Validate locale
  if (!routing.locales.includes(locale as typeof routing.locales[number])) {
    notFound();
  }

  // Load messages for the current locale
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            <ErrorBoundary>
              <NextIntlClientProvider messages={messages}>
                <AuthModalProvider>
                  <NavBar />
                  <MainWithSidebar>{children}</MainWithSidebar>
                  <BottomNav />
                </AuthModalProvider>
              </NextIntlClientProvider>
            </ErrorBoundary>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
