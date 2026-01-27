import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'X-Ray Report',
  description:
    'View your Morningstar X-Ray portfolio analysis report with asset allocation, sector exposure, and geographic distribution.',
  robots: {
    index: false, // Don't index individual X-Ray pages
    follow: false,
  },
};

export default function XRayLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
