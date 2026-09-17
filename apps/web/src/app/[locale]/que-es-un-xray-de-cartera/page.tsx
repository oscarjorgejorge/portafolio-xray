import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { localeMetadata } from '@/lib/seo';
import { WhatIsXrayContent } from '@/components/seo/WhatIsXrayContent';

const PATHNAME = '/que-es-un-xray-de-cartera';

interface WhatIsXrayPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: WhatIsXrayPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seoWhatIs' });

  return {
    ...localeMetadata(locale, PATHNAME),
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
  };
}

export default async function WhatIsXrayPage() {
  return <WhatIsXrayContent />;
}
