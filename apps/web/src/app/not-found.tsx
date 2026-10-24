import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

export const metadata: Metadata = {
  title: '404',
  robots: { index: false, follow: false },
};

/**
 * 404 for unknown URLs and for notFound() under [locale].
 * The root layout has no <html>, so this page renders its own.
 */
export default function NotFound() {
  return (
    <html lang={routing.defaultLocale}>
      <body className="min-h-screen bg-slate-100 font-sans">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-3xl font-bold text-slate-900">404</h1>
          <p className="text-slate-700">
            Página no encontrada · Page not found
          </p>
          <a
            href={`/${routing.defaultLocale}`}
            className="font-medium text-blue-600 underline-offset-2 hover:underline"
          >
            xrayportfolio.com
          </a>
        </main>
      </body>
    </html>
  );
}
