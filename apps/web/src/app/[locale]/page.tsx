import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { localeMetadata, absoluteUrl } from '@/lib/seo';
import { HomePage } from './HomePageClient';

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const seo = localeMetadata(locale, '/');

  return {
    ...seo,
    title: {
      absolute: t('title'),
    },
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      locale: locale === 'es' ? 'es_ES' : 'en_US',
      url: absoluteUrl(locale, '/'),
    },
  };
}

export default function LocaleHomePage() {
  return <HomePage />;
}
