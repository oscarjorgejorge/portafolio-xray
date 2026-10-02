const SECURITY_TOKEN_FIELDS = [
  'LanguageId',
  'PortfolioType',
  'SecurityTokenList',
  'values',
] as const;

/** Site locale to the LanguageId Morningstar renders for this client. */
export const REPORT_LANGUAGE_IDS = {
  es: 'es-ES',
  en: 'en-GB',
} as const;

export type ReportLanguage = keyof typeof REPORT_LANGUAGE_IDS;

export function toReportLanguage(locale: string): ReportLanguage {
  return locale === 'en' ? 'en' : 'es';
}

/**
 * Point an existing X-Ray URL at the report language for the current locale.
 * Stored portfolio links keep the language they were generated with until opened.
 */
export function withReportLanguage(
  morningstarUrl: string,
  language: ReportLanguage,
): string {
  const parsed = parseReportUrl(morningstarUrl);
  if (!parsed) return morningstarUrl;
  parsed.searchParams.set('LanguageId', REPORT_LANGUAGE_IDS[language]);
  return parsed.toString();
}

/**
 * Open a Morningstar X-Ray report.
 * Fund-only links are short GET URLs. A SecurityTokenList is posted as a
 * form so portfolios with stocks stay under the IIS query-string limit.
 */
export function openMorningstarReport(
  morningstarUrl: string,
  language?: ReportLanguage,
): void {
  const localized = language
    ? withReportLanguage(morningstarUrl, language)
    : morningstarUrl;
  const parsed = parseReportUrl(localized);
  const tokenList = parsed?.searchParams.get('SecurityTokenList');
  if (!parsed || !tokenList) {
    window.open(localized, '_blank', 'noopener,noreferrer');
    return;
  }

  const form = document.createElement('form');
  form.method = 'POST';
  // Morningstar reads LanguageId from the query string. A hidden field is ignored
  // and the stock report stays in Spanish.
  const action = new URL(`${parsed.origin}${parsed.pathname}`);
  const languageId = parsed.searchParams.get('LanguageId');
  if (languageId) {
    action.searchParams.set('LanguageId', languageId);
  }
  form.action = action.toString();
  form.target = '_blank';
  form.acceptCharset = 'UTF-8';

  for (const name of SECURITY_TOKEN_FIELDS) {
    const value = parsed.searchParams.get(name);
    if (value == null) continue;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

function parseReportUrl(morningstarUrl: string): URL | null {
  try {
    return new URL(morningstarUrl);
  } catch {
    return null;
  }
}
