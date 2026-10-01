export type ListingKind = 'ordinary' | 'adr' | 'cdr' | 'cedear' | 'gdr' | 'other';

const EXCHANGE_PLACES: Record<string, string> = {
  XMAD: 'Madrid',
  XMCE: 'Madrid',
  XNYS: 'NYSE',
  XNAS: 'NASDAQ',
  ARCX: 'NYSE Arca',
  XLON: 'London',
  XPAR: 'Paris',
  XETR: 'Xetra',
  XFRA: 'Frankfurt',
  XAMS: 'Amsterdam',
  XMIL: 'Milan',
  XMEX: 'Mexico',
  XTSE: 'Toronto',
  XBUE: 'Buenos Aires',
  XSWX: 'SIX',
  NEOE: 'NEO',
  XWBO: 'Vienna',
};

export function listingKind(name: string): ListingKind {
  const normalized = name.toUpperCase();
  if (/\bCEDEAR\b/.test(normalized)) return 'cedear';
  if (/\bCDR\b/.test(normalized) || normalized.includes('CANADIAN DEPOSITORY')) {
    return 'cdr';
  }
  if (/\bGDR\b/.test(normalized)) return 'gdr';
  if (/\bADR\b/.test(normalized) || normalized.includes('DEPOSITARY RECEIPT')) {
    return 'adr';
  }
  return 'ordinary';
}

export function listingPlace(
  isin: string | undefined,
  exchange: string | undefined,
  locale: string,
): string {
  const mic = exchange?.trim().toUpperCase();
  if (mic && EXCHANGE_PLACES[mic]) {
    return EXCHANGE_PLACES[mic];
  }

  const country = isin?.slice(0, 2).toUpperCase();
  if (!country || !/^[A-Z]{2}$/.test(country)) {
    return '';
  }

  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(country) ?? country;
  } catch {
    return country;
  }
}
