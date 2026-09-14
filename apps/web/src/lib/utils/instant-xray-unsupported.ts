/**
 * Instant X-Ray covers UCITS funds, ETFs, ETCs and stocks.
 * Spanish pension plans (PP), Basque EPSV/PPSI and FIL hedge funds
 * are not in that universe, so the PDF omits them.
 */
const UNSUPPORTED_PATTERNS: RegExp[] = [
  /\bEPSV\b/i,
  /\bPPSI\b/i,
  /\bFIL\b/i,
  /\bPP\b/i,
  /\bplan(?:es)?\s+de\s+pensiones\b/i,
  /\bfondo\s+de\s+pensiones\b/i,
  /\bfondo\s+de\s+inversion\s+libre\b/i,
  /\bprevision\s+social\b/i,
];

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

export function isInstantXrayUnsupportedProduct(
  name?: string | null,
): boolean {
  const normalized = stripDiacritics(name ?? '').trim();
  if (!normalized) {
    return false;
  }
  return UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function countInstantXrayUnsupportedHoldings(
  assets: Array<{
    asset?: { name?: string | null } | null;
    identifier?: string | null;
  }>,
): number {
  return assets.filter((holding) =>
    isInstantXrayUnsupportedProduct(holding.asset?.name ?? holding.identifier),
  ).length;
}

export function unmappedInstantXrayFallbackCount(
  holdingsUsingFallback: number,
  unsupportedCount: number,
): number {
  return Math.max(0, holdingsUsingFallback - unsupportedCount);
}
