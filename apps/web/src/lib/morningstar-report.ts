const SECURITY_TOKEN_FIELDS = [
  'LanguageId',
  'PortfolioType',
  'SecurityTokenList',
  'values',
] as const;

/**
 * Open a Morningstar X-Ray report.
 * Fund-only links are short GET URLs. A SecurityTokenList is posted as a
 * form so portfolios with stocks stay under the IIS query-string limit.
 */
export function openMorningstarReport(morningstarUrl: string): void {
  const parsed = parseReportUrl(morningstarUrl);
  const tokenList = parsed?.searchParams.get('SecurityTokenList');
  if (!parsed || !tokenList) {
    window.open(morningstarUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${parsed.origin}${parsed.pathname}`;
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
