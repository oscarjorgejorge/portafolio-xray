import type { Viewport } from 'next';
import { Inter } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/lib/auth';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

