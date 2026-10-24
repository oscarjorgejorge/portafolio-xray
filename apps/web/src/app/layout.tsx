import './globals.css';

/**
 * <html> lives in [locale]/layout.tsx so it can read the locale from params.
 * Calling getLocale() here reads request headers and forces every page to
 * render on demand instead of being served as static HTML.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
