/**
 * Unique, data-derived copy for a public portfolio page.
 * Titles and summaries are built from the portfolio name and its holdings
 * so detail pages do not share one generic string.
 */

import { VALIDATION } from '@/lib/constants';

export interface PortfolioHoldingView {
  morningstarId: string;
  weight: number;
  name: string;
  ticker: string | null;
  isin: string | null;
  type: string | null;
}

export interface PortfolioPageCopy {
  title: string;
  description: string;
  headline: string;
  summary: string;
  columnAsset: string;
  columnIdentifier: string;
  columnWeight: string;
}

const TYPE_LABELS: Record<'es' | 'en', Record<string, string>> = {
  es: {
    ETF: 'ETF',
    FUND: 'fondos',
    STOCK: 'acciones',
    ETC: 'ETC',
  },
  en: {
    ETF: 'ETFs',
    FUND: 'funds',
    STOCK: 'stocks',
    ETC: 'ETCs',
  },
};

function isSpanish(locale: string): boolean {
  return locale === 'es';
}

export function formatHoldingIdentifier(
  holding: Pick<PortfolioHoldingView, 'ticker' | 'isin' | 'morningstarId'>,
): string {
  const ticker = holding.ticker?.trim();
  const isin = holding.isin?.trim();

  if (ticker && isin) {
    return `${ticker} · ${isin}`;
  }
  if (ticker) {
    return ticker;
  }
  if (isin) {
    return isin;
  }
  return holding.morningstarId;
}

function holdingDisplayName(holding: PortfolioHoldingView): string {
  const name = holding.name.trim();
  if (name && name.toUpperCase() !== holding.morningstarId.toUpperCase()) {
    return name;
  }
  return formatHoldingIdentifier(holding);
}

function predominantClass(
  holdings: PortfolioHoldingView[],
): { type: string; weight: number } | null {
  const totals = new Map<string, number>();

  for (const holding of holdings) {
    const type = holding.type?.trim();
    if (!type) {
      continue;
    }
    totals.set(type, (totals.get(type) ?? 0) + holding.weight);
  }

  let best: { type: string; weight: number } | null = null;
  for (const [type, weight] of totals) {
    if (!best || weight > best.weight) {
      best = { type, weight };
    }
  }
  return best;
}

function isDiversified(holdings: PortfolioHoldingView[]): boolean {
  if (holdings.length < 8) {
    return false;
  }
  const topWeight = holdings.reduce(
    (max, holding) => Math.max(max, holding.weight),
    0,
  );
  return topWeight < 30;
}

function fallbackHeadline(
  locale: string,
  holdings: PortfolioHoldingView[],
): string {
  const names = holdings.slice(0, 3).map(holdingDisplayName).filter(Boolean);
  const spanish = isSpanish(locale);

  if (names.length === 0) {
    return spanish ? 'Cartera pública — X-Ray' : 'Public portfolio — X-Ray';
  }

  const list = names.join(', ');
  return spanish
    ? `Cartera con ${list} — X-Ray`
    : `Portfolio with ${list} — X-Ray`;
}

function concentrationSentence(spanish: boolean, diversified: boolean): string {
  if (spanish && diversified) {
    return 'La cartera está diversificada.';
  }
  if (spanish) {
    return 'La cartera está concentrada.';
  }
  if (diversified) {
    return 'The portfolio is diversified.';
  }
  return 'The portfolio is concentrated.';
}

function buildSummary(
  locale: string,
  subject: string,
  holdings: PortfolioHoldingView[],
): string {
  const spanish = isSpanish(locale);
  const count = holdings.length;
  const diversified = isDiversified(holdings);
  const leading = predominantClass(holdings);
  const concentration = concentrationSentence(spanish, diversified);

  const countSentence = spanish
    ? `${subject} reúne ${count} activos.`
    : `${subject} holds ${count} assets.`;

  if (!leading) {
    return `${countSentence} ${concentration}`;
  }

  const label = TYPE_LABELS[spanish ? 'es' : 'en'][leading.type] ?? leading.type;
  const share = Math.round(leading.weight);
  const classSentence = spanish
    ? `La clase predominante es ${label} (${share}% del peso).`
    : `The leading asset class is ${label} (${share}% of weight).`;

  return `${countSentence} ${classSentence} ${concentration}`;
}

export function buildPortfolioPageCopy(
  locale: string,
  portfolioName: string | null | undefined,
  holdings: PortfolioHoldingView[],
): PortfolioPageCopy {
  const spanish = isSpanish(locale);
  const name = portfolioName?.trim() ?? '';
  const count = holdings.length;
  const headline = name || fallbackHeadline(locale, holdings);
  let title = headline;
  if (name) {
    title = spanish
      ? `Cartera ${name}: ${count} activos — X-Ray gratis`
      : `Portfolio ${name}: ${count} assets — free X-Ray`;
  }
  const summary = buildSummary(locale, name || (spanish ? 'Esta cartera' : 'This portfolio'), holdings);

  return {
    title,
    description: summary,
    headline,
    summary,
    columnAsset: spanish ? 'Activo' : 'Asset',
    columnIdentifier: 'Ticker / ISIN',
    columnWeight: spanish ? 'Peso' : 'Weight',
  };
}

/**
 * Sitemap gate. Portfolio has no noindex, isIndexable, or moderationStatus
 * column. A public page is indexable only when it is public and fully allocated,
 * which is the same rule that keeps it out of the 404 noindex response.
 */
export function isIndexablePublicPortfolio(portfolio: {
  id?: string | null;
  isPublic?: boolean;
  assets?: Array<{ weight?: number | null }>;
}): boolean {
  if (!portfolio.id || portfolio.isPublic !== true) {
    return false;
  }

  const assets = portfolio.assets ?? [];
  if (assets.length === 0) {
    return false;
  }

  const total = assets.reduce((sum, asset) => sum + (asset.weight || 0), 0);
  return Math.abs(total - VALIDATION.PERCENTAGE_TOTAL) <= VALIDATION.PERCENTAGE_TOLERANCE;
}
