import type { Metadata } from 'next';
import { ReactNode } from 'react';

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  
  // Locale-specific metadata
  const metadata: Record<string, { title: string; description: string }> = {
    en: {
      title: 'Portfolio X-Ray Generator',
      description:
        'Generate Morningstar X-Ray reports for your investment portfolio. Enter ISINs, tickers, or Morningstar IDs and get instant portfolio analysis.',
    },
    es: {
      title: 'Generador de X-Ray de Cartera',
      description:
        'Genera informes X-Ray de Morningstar para tu cartera de inversión. Introduce ISINs, tickers o IDs de Morningstar y obtén análisis instantáneo.',
    },
  };

  const localeMetadata = metadata[locale] || metadata.en;

  return {
    title: localeMetadata.title,
    description: localeMetadata.description,
    alternates: {
      languages: {
        en: '/en',
        es: '/es',
      },
    },
  };
}

export default function LocaleLayout({ children }: LocaleLayoutProps) {
  return children;
}
