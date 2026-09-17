import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { Alert } from '@/components/ui/Alert';
import { ArrowRightIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';

type SeoHref =
  | '/'
  | '/contact'
  | '/explore'
  | '/portfolios'
  | '/favorites'
  | '/terms'
  | '/privacy'
  | '/register'
  | '/login'
  | '/profile'
  | '/que-es-un-xray-de-cartera'
  | '/como-funciona';

export function SeoTextLink({
  href,
  children,
}: {
  href: SeoHref;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
    >
      {children}
    </Link>
  );
}

export const seoRichLinks = {
  builderLink: (chunks: ReactNode) => (
    <SeoTextLink href="/">{chunks}</SeoTextLink>
  ),
  contactLink: (chunks: ReactNode) => (
    <SeoTextLink href="/contact">{chunks}</SeoTextLink>
  ),
  exploreLink: (chunks: ReactNode) => (
    <SeoTextLink href="/explore">{chunks}</SeoTextLink>
  ),
  portfoliosLink: (chunks: ReactNode) => (
    <SeoTextLink href="/portfolios">{chunks}</SeoTextLink>
  ),
  favoritesLink: (chunks: ReactNode) => (
    <SeoTextLink href="/favorites">{chunks}</SeoTextLink>
  ),
  termsLink: (chunks: ReactNode) => (
    <SeoTextLink href="/terms">{chunks}</SeoTextLink>
  ),
  privacyLink: (chunks: ReactNode) => (
    <SeoTextLink href="/privacy">{chunks}</SeoTextLink>
  ),
  registerLink: (chunks: ReactNode) => (
    <SeoTextLink href="/register">{chunks}</SeoTextLink>
  ),
  loginLink: (chunks: ReactNode) => (
    <SeoTextLink href="/login">{chunks}</SeoTextLink>
  ),
  profileLink: (chunks: ReactNode) => (
    <SeoTextLink href="/profile">{chunks}</SeoTextLink>
  ),
  howItWorksLink: (chunks: ReactNode) => (
    <SeoTextLink href="/como-funciona">{chunks}</SeoTextLink>
  ),
  whatIsLink: (chunks: ReactNode) => (
    <SeoTextLink href="/que-es-un-xray-de-cartera">{chunks}</SeoTextLink>
  ),
};

export function SeoButtonLink({
  href,
  children,
  variant = 'primary',
}: {
  href: SeoHref;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2',
        variant === 'primary'
          ? 'bg-primary text-primary-foreground shadow-sm hover:bg-blue-700 focus:ring-blue-500'
          : 'border border-border bg-card text-foreground hover:bg-muted focus:ring-slate-500',
      )}
    >
      {children}
      {variant === 'primary' && <ArrowRightIcon className="h-4 w-4" />}
    </Link>
  );
}

export function FaqItem({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-b border-border py-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
        {question}
        <span className="text-xl leading-none text-primary transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-3 max-w-2xl leading-7 text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

export function Callout({
  title,
  children,
  variant = 'info',
}: {
  title?: string;
  children: ReactNode;
  variant?: 'info' | 'warning';
}) {
  return (
    <Alert variant={variant} className="mt-6">
      {title ? <p className="font-semibold text-current">{title}</p> : null}
      <div className={title ? 'mt-2 text-sm leading-6' : 'text-sm leading-6'}>
        {children}
      </div>
    </Alert>
  );
}

export function InsightCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-primary">
        {icon}
      </span>
      <p className="mt-5 font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </article>
  );
}

export function StepNumber({ value }: { value: string }) {
  return (
    <span className="text-4xl font-semibold tracking-tight text-slate-300">
      {value}
    </span>
  );
}
