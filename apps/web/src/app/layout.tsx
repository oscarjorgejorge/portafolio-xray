import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/lib/auth';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

const APP_NAME = 'Portfolio X-Ray Generator';
const APP_DESCRIPTION =
  'Generate Morningstar X-Ray reports for your investment portfolio. Enter ISINs, tickers, or Morningstar IDs and get instant portfolio analysis including asset allocation, sector exposure, and geographic distribution.';

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
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
    locale: 'en_US',
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

