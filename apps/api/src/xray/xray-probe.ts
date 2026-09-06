import { MORNINGSTAR_URL } from '../common/constants';
import { normalizeFundName } from '../assets/resolver/utils/canonical-fund-id';

export type XRayProbeResult = {
  ok: boolean;
  reason: string;
};

/**
 * Instant X-Ray URL for a single fund at 100% weight
 */
export function buildXRayProbeUrl(baseUrl: string, fundId: string): string {
  const url = new URL(`${baseUrl}${MORNINGSTAR_URL.XRAY_PATH}`);
  url.searchParams.set('LanguageId', MORNINGSTAR_URL.LANGUAGE_ID);
  url.searchParams.set('PortfolioType', MORNINGSTAR_URL.PORTFOLIO_TYPE);
  url.searchParams.set(
    'SecurityTokenList',
    `${fundId}]2]0]FOESP${MORNINGSTAR_URL.SECURITY_TOKEN_SUFFIX}`,
  );
  url.searchParams.set('values', '10000');
  return url.toString();
}

/**
 * Decide whether an Instant X-Ray report recognized the expected fund
 */
export function evaluateXRayProbeHtml(
  html: string,
  expectedName: string,
): XRayProbeResult {
  if (!html || html.trim().length === 0) {
    return { ok: false, reason: 'empty_report' };
  }

  if (/fondo no disponible/i.test(html)) {
    return { ok: false, reason: 'xray_unavailable' };
  }

  const normalizedHtml = normalizeFundName(stripTags(html));
  const normalizedName = normalizeFundName(expectedName);
  if (!normalizedName) {
    return { ok: false, reason: 'empty_name' };
  }

  if (normalizedHtml.includes(normalizedName)) {
    return { ok: true, reason: 'ok' };
  }

  const tokens = normalizedName.split(' ').filter((word) => word.length > 3);
  if (tokens.length === 0) {
    return { ok: false, reason: 'name_not_in_report' };
  }

  const matched = tokens.filter((token) => normalizedHtml.includes(token));
  const required = Math.min(2, tokens.length);
  if (matched.length >= required) {
    return { ok: true, reason: 'ok' };
  }

  return { ok: false, reason: 'name_not_in_report' };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}
