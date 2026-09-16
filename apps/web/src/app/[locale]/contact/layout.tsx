import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { localeMetadata } from '@/lib/seo';

interface ContactLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: ContactLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });

  return {
    ...localeMetadata(locale, '/contact'),
    title: t('title'),
    description: t('description'),
  };
}

export default function ContactLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
