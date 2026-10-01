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

const TITLE_ASSET_LIMIT = 65;
const SHORT_ID_LENGTH = 8;

function byWeight(holdings: PortfolioHoldingView[]): PortfolioHoldingView[] {
  return [...holdings].sort((left, right) => right.weight - left.weight);
}

/**
 * First 8 characters of the portfolio id. Always appended to the title and
 * description: duplicate names are not only generic labels, and this render
 * path cannot see the other portfolios to detect a collision.
 */
function withShortId(text: string, portfolioId: string | null | undefined): string {
  const shortId = portfolioId?.trim().slice(0, SHORT_ID_LENGTH) ?? '';
  if (shortId.length < SHORT_ID_LENGTH) {
    return text;
  }
  return `${text} (${shortId})`;
}

function namedTitle(locale: string, name: string, clause: string): string {
  return isSpanish(locale)
    ? `Cartera ${name}: ${clause} — X-Ray gratis`
    : `Portfolio ${name}: ${clause} — free X-Ray`;
}

function holdingTitleClause(
  locale: string,
  name: string,
  ranked: PortfolioHoldingView[],
): string {
  const spanish = isSpanish(locale);
  const labels = ranked.map(holdingDisplayName).filter(Boolean);
  const count = ranked.length;

  if (labels.length === 0) {
    return spanish ? `${count} activos` : `${count} assets`;
  }

  if (labels.length === 1) {
    return labels[0];
  }

  const single = spanish
    ? `${labels[0]} y ${labels.length - 1} más`
    : `${labels[0]} and ${labels.length - 1} more`;
  const remaining = labels.length - 2;
  let pair = spanish
    ? `${labels[0]} y ${labels[1]}`
    : `${labels[0]} and ${labels[1]}`;

  if (remaining > 0) {
    pair = spanish
      ? `${pair} y ${remaining} más`
      : `${pair} and ${remaining} more`;
  }

  if (namedTitle(locale, name, pair).length <= TITLE_ASSET_LIMIT) {
    return pair;
  }

  return single;
}

function leadHoldingSentence(
  spanish: boolean,
  holding: PortfolioHoldingView | undefined,
): string | null {
  if (!holding) {
    return null;
  }

  const label = holdingDisplayName(holding);
  if (!label) {
    return null;
  }

  const share = Math.round(holding.weight);
  return spanish
    ? `${label} es la posición principal (${share}% del peso).`
    : `${label} is the largest holding (${share}% of weight).`;
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
  const lead = leadHoldingSentence(spanish, holdings[0]);

  const countSentence = spanish
    ? `${subject} reúne ${count} activos.`
    : `${subject} holds ${count} assets.`;

  const parts = [countSentence];
  if (lead) {
    parts.push(lead);
  }

  if (leading) {
    const label = TYPE_LABELS[spanish ? 'es' : 'en'][leading.type] ?? leading.type;
    const share = Math.round(leading.weight);
    parts.push(
      spanish
        ? `La clase predominante es ${label} (${share}% del peso).`
        : `The leading asset class is ${label} (${share}% of weight).`,
    );
  }

  parts.push(concentration);
  return parts.join(' ');
}

export function buildPortfolioPageCopy(
  locale: string,
  portfolioName: string | null | undefined,
  holdings: PortfolioHoldingView[],
  portfolioId?: string | null,
): PortfolioPageCopy {
  const spanish = isSpanish(locale);
  const name = portfolioName?.trim() ?? '';
  const ranked = byWeight(holdings);
  const headline = name || fallbackHeadline(locale, ranked);
  const baseTitle = name
    ? namedTitle(locale, name, holdingTitleClause(locale, name, ranked))
    : headline;
  const title = withShortId(baseTitle, portfolioId);
  const summary = withShortId(
    buildSummary(
      locale,
      name || (spanish ? 'Esta cartera' : 'This portfolio'),
      ranked,
    ),
    portfolioId,
  );

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
