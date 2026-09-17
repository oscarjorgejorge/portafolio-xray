import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { localeMetadata } from '@/lib/seo';
import { HowItWorksContent } from '@/components/seo/HowItWorksContent';

const PATHNAME = '/como-funciona';

interface HowItWorksPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: HowItWorksPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seoHowItWorks' });

  return {
    ...localeMetadata(locale, PATHNAME),
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
  };
}

export default async function HowItWorksPage() {
  return <HowItWorksContent />;
}
