import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import {
  InputType,
  SearchResult,
  ScoredResult,
  ResolutionResult,
  ResolverConfig,
  VerificationResult,
  MorningstarAssetType,
  MorningstarApiItem,
  GlobalMorningstarItem,
} from './resolver.types';

/**
 * MorningstarResolverService
 * Resolves ISIN/ticker/text to Morningstar IDs using multiple search strategies
 * Ported from POC with all search strategies intact
 */
@Injectable()
export class MorningstarResolverService {
  private readonly logger = new Logger(MorningstarResolverService.name);

  private readonly config: ResolverConfig = {
    searchDelay: 500,
    maxResults: 10,
    minConfidence: 0.7,
    domains: ['morningstar.com', 'morningstar.es', 'global.morningstar.com'],
  };

  // European markets to try when a fund is not available in the default market (ES)
  // Ordered by likelihood of fund availability (Luxembourg is most common for UCITS funds)
  private readonly EUROPEAN_MARKETS = [
    'lu',
    'de',
    'it',
    'ch',
    'gb',
    'fr',
    'nl',
    'at',
    'be',
  ];

  // Morningstar type mapping
  private readonly MORNINGSTAR_TYPE_MAP: Record<string, MorningstarAssetType> =
    {
      FO: 'Fondo',
      FE: 'Fondo',
      FC: 'Fondo',
      CE: 'ETF',
      ET: 'ETF',
      ST: 'Accion',
      EQ: 'Accion',
      IX: 'Fondo',
    };

  // ============================================
  // INPUT NORMALIZATION
  // ============================================

  private normalizeInput(input: string): string {
    return input.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  private classifyInput(input: string): InputType {
    const normalized = this.normalizeInput(input);

    if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(normalized)) {
      return 'ISIN';
    }

    if (/^(0P000|F000|F00000)[A-Z0-9]+$/i.test(normalized)) {
      return 'MORNINGSTAR_ID';
    }

    if (/^[A-Z]{1,5}$/.test(normalized)) {
      return 'TICKER';
    }

    return 'FREE_TEXT';
  }

  // ============================================
  // MORNINGSTAR ID EXTRACTION
  // ============================================

  private extractMorningstarId(url: string): string | null {
    const patterns = [
      /\/fondos\/([F0][A-Z0-9]{8,12})\//i,
      /\/funds\/([F0][A-Z0-9]{8,12})\//i,
      /\/etfs\/([F0][A-Z0-9]{8,12})\//i,
      /[?&]id=([F0][A-Z0-9]{8,12})/i,
      /(0P000[A-Z0-9]{5,7})/i,
      /(F000[A-Z0-9]{5,8})/i,
      /(F00000[A-Z0-9]{4,6})/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
    }

    return null;
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  private mapMorningstarType(
    rawType: string | undefined,
  ): MorningstarAssetType {
    if (!rawType) return 'Desconocido';
    const upperType = rawType.toUpperCase();
    return this.MORNINGSTAR_TYPE_MAP[upperType] || 'Desconocido';
  }

  /**
   * Build Morningstar URL for a given ID
   * @param id - Morningstar ID
   * @param securityType - Security type (2 = fund, 3 = stock)
   * @param marketId - Optional market ID for multi-market support (e.g., 'lu', 'de', 'it')
   */
  private buildMorningstarUrl(
    id: string,
    securityType: number | string | undefined,
    marketId?: string,
  ): string {
    const type =
      typeof securityType === 'number'
        ? securityType
        : parseInt(securityType || '2', 10);

    // If marketId is provided, use the en-eu format with marketID parameter
    if (marketId) {
      const assetPath = type === 3 ? 'stocks' : 'funds';
      return `https://global.morningstar.com/en-eu/investments/${assetPath}/${id}/quote?marketID=${marketId}`;
    }

    // Default: Spanish market (original behavior)
    if (type === 3) {
      return `https://global.morningstar.com/es/inversiones/acciones/${id}/cotizacion`;
    }
    return `https://global.morningstar.com/es/inversiones/fondos/${id}/cotizacion`;
  }

  // ============================================
  // SCORING SYSTEM
  // ============================================

  private scoreResult(
    result: SearchResult,
    originalInput: string,
    inputType: InputType,
  ): ScoredResult {
    const breakdown = {
      isinMatch: 0,
      tickerMatch: 0,
      nameMatch: 0,
      morningstarDomain: 0,
      typeMatch: 0,
      morningstarIdMatch: 0,
    };

    const textToSearch =
      `${result.title} ${result.snippet} ${result.url}`.toUpperCase();
    const normalizedInput = this.normalizeInput(originalInput);

    // +100 if Morningstar ID matches exactly (highest priority)
    if (
      inputType === 'MORNINGSTAR_ID' &&
      result.morningstarId &&
      result.morningstarId.toUpperCase() === normalizedInput
    ) {
      breakdown.morningstarIdMatch = 100;
    }

    // +50 if ISIN appears in result
    if (inputType === 'ISIN' && textToSearch.includes(normalizedInput)) {
      breakdown.isinMatch = 50;
    }

    // +40 if ticker matches exactly
    if (inputType === 'TICKER') {
      const tickerPattern = new RegExp(`\\b${normalizedInput}\\b`, 'i');
      const tickerValue =
        typeof result.ticker === 'string' ? result.ticker.toUpperCase() : '';
      if (tickerPattern.test(result.title) || tickerValue === normalizedInput) {
        breakdown.tickerMatch = 40;
      }
    }

    // +30 for partial name match (FREE_TEXT)
    if (inputType === 'FREE_TEXT') {
      const words = normalizedInput.split(' ').filter((w) => w.length > 3);
      const matchedWords = words.filter((w) => textToSearch.includes(w));
      breakdown.nameMatch = Math.round(
        (matchedWords.length / Math.max(words.length, 1)) * 30,
      );
    }

    // +20 for Morningstar domain
    if (
      this.config.domains.some((d) =>
        result.domain.includes(d.replace('www.', '')),
      )
    ) {
      breakdown.morningstarDomain = 20;
    }

    // +10 for valid Morningstar ID
    if (result.morningstarId) {
      breakdown.typeMatch = 10;
    }

    // +15 bonus for fund IDs starting with "F" (preferred format for funds)
    if (
      result.morningstarId &&
      result.assetType === 'Fondo' &&
      result.morningstarId.toUpperCase().startsWith('F')
    ) {
      breakdown.typeMatch += 15;
    }

    const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);

    return {
      ...result,
      score: totalScore,
      scoreBreakdown: breakdown,
    };
  }

  // ============================================
  // SEARCH STRATEGIES
  // ============================================

  /**
   * Strategy A: Morningstar.es API (Best source)
   */
  private async searchMorningstarAPI(query: string): Promise<SearchResult[]> {
    this.logger.debug(`[API] Searching Morningstar API for: ${query}`);

    const endpoint = `https://www.morningstar.es/es/util/SecuritySearch.ashx?q=${encodeURIComponent(query)}&limit=10&preferedList=`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'es-ES,es;q=0.9',
          Referer: 'https://www.morningstar.es/',
        },
      });

      if (!response.ok) return [];

      const text = await response.text();
      const results: SearchResult[] = [];
      const jsonMatches = text.match(/\{[^{}]+\}/g);

      if (jsonMatches) {
        for (const jsonStr of jsonMatches) {
          try {
            const item = JSON.parse(jsonStr) as MorningstarApiItem;
            const rawType = item.tt ?? item.Type ?? item.type;
            const securityType = item.t ?? item.tt ?? item.Type ?? 2;
            const isStock = securityType === 3 || securityType === '3';
            const detectedAssetType: MorningstarAssetType = isStock
              ? 'Accion'
              : rawType === 'CE' || rawType === 'ET'
                ? 'ETF'
                : 'Fondo';

            // For funds, prioritize IDs starting with "F" over "0P"
            // For stocks, use the standard priority (pi first)
            let principalId: string | null = null;
            let secondaryId: string | null = null;

            if (isStock) {
              // For stocks, use standard priority
              principalId = item.pi ?? item.i ?? null;
              secondaryId = item.i && item.i !== principalId ? item.i : null;
            } else {
              // For funds, prioritize IDs starting with "F"
              const piId = item.pi ?? null;
              const iId = item.i ?? null;

              // Check if either ID starts with "F"
              const piStartsWithF =
                piId?.toUpperCase().startsWith('F') ?? false;
              const iStartsWithF = iId?.toUpperCase().startsWith('F') ?? false;

              if (piStartsWithF || iStartsWithF) {
                // Prefer the one starting with "F"
                principalId = piStartsWithF ? piId : iId;
                secondaryId = piStartsWithF
                  ? iId && iId !== principalId
                    ? iId
                    : null
                  : piId && piId !== principalId
                    ? piId
                    : null;
              } else {
                // If neither starts with "F", use standard priority
                principalId = piId ?? iId ?? null;
                secondaryId = iId && iId !== principalId ? iId : null;
              }
            }

            if (principalId) {
              const tickerString = item.ticker;
              const isinString = item.isin;

              results.push({
                url: this.buildMorningstarUrl(principalId, securityType),
                title: item.n ?? '',
                snippet: `ID Principal: ${principalId} | Tipo: ${detectedAssetType}${isinString ? ` | ISIN: ${isinString}` : ''}`,
                morningstarId: principalId,
                domain: 'global.morningstar.com',
                ticker: tickerString,
                isin: isinString,
                assetType: detectedAssetType,
                rawType: rawType,
              });

              // Add secondary ID if different
              if (secondaryId && secondaryId !== principalId) {
                results.push({
                  url: this.buildMorningstarUrl(secondaryId, securityType),
                  title: item.n ?? '',
                  snippet: `ID Secundario: ${secondaryId} | Tipo: ${detectedAssetType}${isinString ? ` | ISIN: ${isinString}` : ''}`,
                  morningstarId: secondaryId,
                  domain: 'global.morningstar.com',
                  ticker: tickerString,
                  isin: isinString,
                  assetType: detectedAssetType,
                  rawType: rawType,
                });
              }
            }
          } catch {
            // Ignore invalid JSON
          }
        }
      }

      if (results.length > 0) {
        this.logger.debug(`[API] Found ${results.length} results`);
      }
      return results;
    } catch (error) {
      this.logger.warn(`[API] Error: ${error}`);
      return [];
    }
  }

  /**
   * Strategy B: HTML scraping from morningstar.es search page
   */
  private async searchMorningstarHTML(query: string): Promise<SearchResult[]> {
    this.logger.debug(`[HTML] Scraping search page for: ${query}`);

    const searchUrl = `https://www.morningstar.es/es/funds/SecuritySearchResults.aspx?search=${encodeURIComponent(query)}&type=`;

    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-ES,es;q=0.9',
        },
      });

      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $(
        'a[href*="id="], a[href*="/funds/"], a[href*="/fondos/"], a[href*="/etf/"]',
      ).each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();

        if (href && text) {
          const id = this.extractMorningstarId(href);
          if (id) {
            const fullUrl = href.startsWith('http')
              ? href
              : `https://www.morningstar.es${href}`;
            results.push({
              url: fullUrl,
              title: text,
              snippet: '',
              morningstarId: id,
              domain: this.extractDomain(fullUrl),
            });
          }
        }
      });

      if (results.length > 0) {
        this.logger.debug(`[HTML] Found ${results.length} results`);
      }
      return results.slice(0, 5);
    } catch (error) {
      this.logger.warn(`[HTML] Error: ${error}`);
      return [];
    }
  }

  /**
   * Strategy C: Global Morningstar API (backup)
   */
  private async searchGlobalMorningstar(
    query: string,
  ): Promise<SearchResult[]> {
    this.logger.debug(
      `[GLOBAL] Searching global.morningstar.com for: ${query}`,
    );

    const endpoint = `https://global.morningstar.com/api/v1/security/search?q=${encodeURIComponent(query)}&languageId=es-ES&countryId=ES`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
          Origin: 'https://global.morningstar.com',
          Referer: 'https://global.morningstar.com/',
        },
      });

      if (!response.ok) return [];

      const text = await response.text();
      try {
        const data = JSON.parse(text) as GlobalMorningstarItem[];

        if (Array.isArray(data) && data.length > 0) {
          this.logger.debug(`[GLOBAL] Found ${data.length} results`);
          return data.slice(0, 5).map((item: GlobalMorningstarItem) => ({
            url: `https://global.morningstar.com/es/inversiones/fondos/${item.securityId ?? item.id ?? ''}/cotizacion`,
            title: item.name ?? item.legalName ?? '',
            snippet: `${item.isin ?? ''} | ${item.ticker ?? ''}`,
            morningstarId: item.securityId ?? item.id ?? null,
            domain: 'global.morningstar.com',
            ticker: item.ticker,
          }));
        }
      } catch {
        // Not valid JSON
      }
    } catch {
      // Continue with next strategy
    }

    return [];
  }

  /**
   * Strategy D: DuckDuckGo (fallback)
   * Searches both Spanish (/inversiones/fondos/) and English (/investments/funds/) paths
   */
  private async searchDuckDuckGo(query: string): Promise<SearchResult[]> {
    this.logger.debug(`[DDG] Searching DuckDuckGo for: ${query}`);

    // Search both Spanish and English paths
    const searchQueries = [
      `site:global.morningstar.com/*/inversiones/fondos "${query}"`,
      `site:global.morningstar.com/*/investments/funds "${query}"`,
    ];

    const allResults: SearchResult[] = [];

    for (const searchQuery of searchQueries) {
      const results = await this.searchDuckDuckGoSingle(query, searchQuery);
      allResults.push(...results);
    }

    // Deduplicate by Morningstar ID
    const seen = new Set<string>();
    return allResults.filter((r) => {
      if (!r.morningstarId) return true;
      if (seen.has(r.morningstarId)) return false;
      seen.add(r.morningstarId);
      return true;
    });
  }

  /**
   * Single DuckDuckGo search helper
   */
  private async searchDuckDuckGoSingle(
    originalQuery: string,
    searchQuery: string,
  ): Promise<SearchResult[]> {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $('.result').each((_, element) => {
        const $el = $(element);
        const $link = $el.find('.result__a');
        const $snippet = $el.find('.result__snippet');

        let url = $link.attr('href') || '';
        const title = $link.text().trim();
        const snippet = $snippet.text().trim();

        if (url.includes('uddg=')) {
          const match = url.match(/uddg=([^&]+)/);
          if (match) url = decodeURIComponent(match[1]);
        }

        if (url.includes('morningstar') && !url.includes('doc.morningstar')) {
          const id = this.extractMorningstarId(url);
          results.push({
            url,
            title,
            snippet,
            morningstarId: id,
            domain: this.extractDomain(url),
          });
        }
      });

      if (results.length > 0) {
        this.logger.debug(`[DDG] Found ${results.length} results`);
      }
      return results;
    } catch (error) {
      this.logger.warn(`[DDG] Error: ${error}`);
      return [];
    }
  }

  // ============================================
  // PAGE VERIFICATION
  // ============================================

  // Valid ISIN country code prefixes (excludes Morningstar ID prefixes like F0, 0P)
  private readonly VALID_ISIN_PREFIXES = [
    'LU',
    'IE',
    'DE',
    'FR',
    'GB',
    'NL',
    'CH',
    'AT',
    'ES',
    'IT',
    'BE',
    'SE',
    'NO',
    'DK',
    'FI',
    'PT',
    'US',
    'CA',
    'JP',
    'AU',
    'HK',
    'SG',
  ];

  /**
   * Check if a string is a valid ISIN (not a Morningstar ID)
   */
  private isValidIsin(candidate: string): boolean {
    if (!candidate || candidate.length !== 12) return false;
    const prefix = candidate.substring(0, 2).toUpperCase();
    return this.VALID_ISIN_PREFIXES.includes(prefix);
  }

  /**
   * Check if a page shows "not available in this market" message
   */
  private isMarketNotAvailable(html: string, $: cheerio.CheerioAPI): boolean {
    const bodyText = $('body').text().toLowerCase();
    const notAvailablePatterns = [
      'no está disponible en el mercado',
      'not available in the market',
      'not available in this market',
      'título no está disponible',
      'title is not available',
      'elija uno de los mercados',
      'choose one of the markets',
      'select a different market',
    ];
    return notAvailablePatterns.some((pattern) => bodyText.includes(pattern));
  }

  private async verifyFundPage(
    url: string,
    expectedIsin: string,
  ): Promise<VerificationResult> {
    this.logger.debug(`[VERIFY] Verifying page: ${url}`);

    const result: VerificationResult = {
      verified: false,
      isinFound: null,
      nameFound: null,
      additionalInfo: {},
    };

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      });

      if (!response.ok) {
        this.logger.warn(`[VERIFY] HTTP ${response.status}`);
        // Treat non-200 responses (especially 404) as "not available in this market"
        if (response.status === 404) {
          result.additionalInfo.marketNotAvailable = 'true';
          result.additionalInfo.httpStatus = response.status.toString();
        }
        return result;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Check if the fund is not available in this market
      if (this.isMarketNotAvailable(html, $)) {
        this.logger.debug(`[VERIFY] Fund not available in this market`);
        result.additionalInfo.marketNotAvailable = 'true';
        return result;
      }

      // Collect all potential ISINs found
      const foundIsins: string[] = [];

      // Strategy 1: Check meta tags (most reliable for SSR pages)
      // Meta keywords often contains the ISIN: "LU2485535293 Resumen, Fund Name..."
      const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
      const metaDescription =
        $('meta[name="description"]').attr('content') || '';
      const metaContent = `${metaKeywords} ${metaDescription}`;

      this.logger.debug(
        `[VERIFY] Meta keywords: ${metaKeywords.substring(0, 100)}...`,
      );

      // Strategy 2: Check title and h1 (often contains ISIN)
      const pageTitle = $('title').text() || '';
      const h1Text = $('h1').first().text() || '';

      // Strategy 3: Check body text
      const pageText = $('body').text();

      // Combined text to search (prioritize meta tags)
      const allTextSources = [metaContent, pageTitle, h1Text, pageText];

      // ISIN pattern: 2 letter country code + 10 alphanumeric
      const isinPattern = /\b([A-Z]{2}[A-Z0-9]{10})\b/gi;

      for (const textSource of allTextSources) {
        const matches = textSource.match(isinPattern);
        if (matches) {
          for (const match of matches) {
            const candidate = match.toUpperCase();
            if (
              this.isValidIsin(candidate) &&
              !foundIsins.includes(candidate)
            ) {
              foundIsins.push(candidate);
              this.logger.debug(`[VERIFY] Found valid ISIN: ${candidate}`);
            }
          }
        }
        // If we found ISINs in meta tags, prioritize those and stop
        if (foundIsins.length > 0 && textSource === metaContent) {
          this.logger.debug(`[VERIFY] Using ISIN from meta tags`);
          break;
        }
      }

      this.logger.debug(
        `[VERIFY] Found ${foundIsins.length} potential ISINs: ${foundIsins.join(', ') || 'none'}`,
      );

      // Use the first valid ISIN found
      if (foundIsins.length > 0) {
        result.isinFound = foundIsins[0];

        if (expectedIsin && result.isinFound === expectedIsin.toUpperCase()) {
          result.verified = true;
          this.logger.log(`[VERIFY] ISIN confirmed: ${result.isinFound}`);
        } else if (result.isinFound) {
          this.logger.log(`[VERIFY] ISIN extracted: ${result.isinFound}`);
        }
      }

      // Extract fund name
      const nameSelectors = [
        'h1',
        '.security-name',
        '[data-testid="security-name"]',
        '.fund-name',
        'title',
      ];
      for (const selector of nameSelectors) {
        const name = $(selector).first().text().trim();
        if (name && name.length > 3 && name.length < 200) {
          result.nameFound = name.replace(/\s+/g, ' ').trim();
          break;
        }
      }

      // Additional info
      const infoPatterns: Record<string, RegExp> = {
        ticker: /(?:Ticker|Symbol)[:\s]*([A-Z0-9]{1,10})/i,
        category: /(?:Categoría|Category)[:\s]*([^\n\r<]{3,50})/i,
        currency: /(?:Divisa|Currency)[:\s]*([A-Z]{3})/i,
      };

      for (const [key, pattern] of Object.entries(infoPatterns)) {
        const match = pageText.match(pattern);
        if (match?.[1]) {
          result.additionalInfo[key] = match[1].trim();
        }
      }

      if (!result.verified && result.isinFound) {
        this.logger.warn(
          `[VERIFY] ISIN found (${result.isinFound}) doesn't match expected (${expectedIsin})`,
        );
      }
    } catch (error) {
      this.logger.warn(`[VERIFY] Error: ${error}`);
    }

    return result;
  }

  /**
   * Verify fund page with multi-market fallback
   * If the fund is not available in the default Spanish market, try other European markets
   */
  private async verifyFundPageWithFallback(
    morningstarId: string,
    expectedIsin: string,
    securityType: number | string = 2,
  ): Promise<{
    verification: VerificationResult;
    workingUrl: string;
    marketId?: string;
  }> {
    // First, try the default Spanish market URL
    const defaultUrl = this.buildMorningstarUrl(morningstarId, securityType);
    let verification = await this.verifyFundPage(defaultUrl, expectedIsin);

    // If the fund is available in Spanish market, return immediately
    if (verification.additionalInfo?.marketNotAvailable !== 'true') {
      return { verification, workingUrl: defaultUrl };
    }

    this.logger.log(
      `[FALLBACK] Fund ${morningstarId} not available in ES market, trying other markets...`,
    );

    // Try other European markets
    for (const marketId of this.EUROPEAN_MARKETS) {
      const marketUrl = this.buildMorningstarUrl(
        morningstarId,
        securityType,
        marketId,
      );
      this.logger.debug(`[FALLBACK] Trying market: ${marketId}`);

      verification = await this.verifyFundPage(marketUrl, expectedIsin);

      // If we found the fund (not "market not available" and has ISIN or name)
      if (
        verification.additionalInfo?.marketNotAvailable !== 'true' &&
        (verification.isinFound || verification.nameFound)
      ) {
        this.logger.log(
          `[FALLBACK] Fund ${morningstarId} found in ${marketId.toUpperCase()} market` +
            (verification.isinFound
              ? ` (ISIN: ${verification.isinFound})`
              : ''),
        );
        return { verification, workingUrl: marketUrl, marketId };
      }
    }

    // If no market worked, return the original result
    this.logger.warn(
      `[FALLBACK] Fund ${morningstarId} not found in any European market`,
    );
    return { verification, workingUrl: defaultUrl };
  }

  // ============================================
  // COMBINED SEARCH
  // ============================================

  private async searchAll(query: string): Promise<SearchResult[]> {
    // Execute all strategies in parallel
    const [apiResults, globalResults, ddgResults] = await Promise.all([
      this.searchMorningstarAPI(query),
      this.searchGlobalMorningstar(query),
      this.searchDuckDuckGo(query),
    ]);

    // Priority: API first (best source)
    const allResults: SearchResult[] = [
      ...apiResults,
      ...globalResults,
      ...ddgResults,
    ];

    // If nothing found, try HTML scraping
    if (allResults.length === 0) {
      const htmlResults = await this.searchMorningstarHTML(query);
      allResults.push(...htmlResults);
    }

    // Deduplicate by Morningstar ID
    const seen = new Set<string>();
    const unique = allResults.filter((r) => {
      if (!r.morningstarId) return true;
      if (seen.has(r.morningstarId)) return false;
      seen.add(r.morningstarId);
      return true;
    });

    this.logger.debug(`Total unique results: ${unique.length}`);

    return unique.slice(0, this.config.maxResults);
  }

  // ============================================
  // MAIN RESOLVER
  // ============================================

  /**
   * Resolve an asset identifier to Morningstar ID
   * @param input - ISIN, Morningstar ID, ticker, or free text
   * @returns Resolution result with confidence score
   */
  async resolve(input: string): Promise<ResolutionResult> {
    const normalizedInput = this.normalizeInput(input);
    const inputType = this.classifyInput(normalizedInput);

    this.logger.log(`Resolving: ${input} (type: ${inputType})`);

    // Search using all strategies
    const searchResults = await this.searchAll(normalizedInput);

    // Initial scoring
    let scoredResults = searchResults
      .map((r) => this.scoreResult(r, input, inputType))
      .sort((a, b) => b.score - a.score);

    // For funds: if multiple results have the same name, prioritize the one with "F" ID
    if (scoredResults.length > 1) {
      const firstResult = scoredResults[0];
      const isFund =
        firstResult?.assetType === 'Fondo' || firstResult?.assetType === 'ETF';

      if (isFund && firstResult?.title) {
        // Find all results with the same name (normalized)
        const normalizedTitle = this.normalizeInput(firstResult.title);
        const sameNameResults = scoredResults.filter(
          (r) => r.title && this.normalizeInput(r.title) === normalizedTitle,
        );

        // If multiple results have the same name, prefer the one with "F" ID
        if (sameNameResults.length > 1) {
          const fIdResult = sameNameResults.find(
            (r) =>
              r.morningstarId && r.morningstarId.toUpperCase().startsWith('F'),
          );

          if (fIdResult && fIdResult !== firstResult) {
            // Move the "F" ID result to the top
            scoredResults = [
              fIdResult,
              ...scoredResults.filter((r) => r !== fIdResult),
            ];
            this.logger.log(
              `Found multiple results with same name "${normalizedTitle}", prioritizing "F" ID: ${fIdResult.morningstarId}`,
            );
          }
        }
      }
    }

    // Determine initial state
    const bestMatch = scoredResults[0] || null;
    let status: 'resolved' | 'needs_review' | 'not_found' = 'not_found';
    let confidence = 0;
    let verification: VerificationResult | undefined = undefined;

    // If input is a Morningstar ID and we have an exact match, verify page with multi-market fallback
    if (
      inputType === 'MORNINGSTAR_ID' &&
      bestMatch?.morningstarId &&
      bestMatch.morningstarId.toUpperCase() === normalizedInput
    ) {
      // Verify the page with multi-market fallback to extract the real ISIN
      const {
        verification: verResult,
        workingUrl,
        marketId,
      } = await this.verifyFundPageWithFallback(bestMatch.morningstarId, '');
      verification = verResult;

      // Update the URL if we found a working market
      if (workingUrl !== bestMatch.url) {
        bestMatch.url = workingUrl;
        if (marketId) {
          bestMatch.snippet = `${bestMatch.snippet} | Market: ${marketId.toUpperCase()}`;
        }
      }

      status = 'resolved';
      confidence = 1.0;
      this.logger.log(
        `Exact Morningstar ID match found: ${normalizedInput} -> ${bestMatch.morningstarId}${verification?.isinFound ? ` (ISIN: ${verification.isinFound})` : ''}${marketId ? ` (market: ${marketId})` : ''}`,
      );

      if (verification?.nameFound) {
        bestMatch.title = verification.nameFound;
      }
    }
    // If input is a Morningstar ID but no search results found, try direct verification with fallback
    else if (inputType === 'MORNINGSTAR_ID' && !bestMatch) {
      this.logger.log(
        `[DIRECT] No search results for Morningstar ID ${normalizedInput}, trying direct verification...`,
      );

      const {
        verification: verResult,
        workingUrl,
        marketId,
      } = await this.verifyFundPageWithFallback(normalizedInput, '');
      verification = verResult;

      // If we found the fund in any market
      if (verification.isinFound || verification.nameFound) {
        // Create a synthetic bestMatch
        const syntheticMatch: ScoredResult = {
          url: workingUrl,
          title: verification.nameFound || normalizedInput,
          snippet: `Direct resolution${marketId ? ` | Market: ${marketId.toUpperCase()}` : ''}`,
          morningstarId: normalizedInput,
          domain: 'global.morningstar.com',
          isin: verification.isinFound || undefined,
          score: 100,
          scoreBreakdown: {
            isinMatch: 0,
            tickerMatch: 0,
            nameMatch: 0,
            morningstarDomain: 20,
            typeMatch: 10,
            morningstarIdMatch: 100,
          },
        };

        scoredResults = [syntheticMatch];
        status = 'resolved';
        confidence = 1.0;
        this.logger.log(
          `[DIRECT] Fund resolved via direct verification: ${normalizedInput}${verification.isinFound ? ` (ISIN: ${verification.isinFound})` : ''}${marketId ? ` (market: ${marketId})` : ''}`,
        );
      }
    }
    // If we have a candidate with Morningstar ID and it's ISIN, VERIFY with fallback
    else if (bestMatch?.morningstarId && inputType === 'ISIN') {
      const {
        verification: verResult,
        workingUrl,
        marketId,
      } = await this.verifyFundPageWithFallback(
        bestMatch.morningstarId,
        normalizedInput,
      );
      verification = verResult;

      // Update the URL if we found a working market
      if (workingUrl !== bestMatch.url) {
        bestMatch.url = workingUrl;
        if (marketId) {
          bestMatch.snippet = `${bestMatch.snippet} | Market: ${marketId.toUpperCase()}`;
        }
      }

      if (verification.verified) {
        bestMatch.score += 50;
        bestMatch.scoreBreakdown.isinMatch = 50;

        if (verification.nameFound) {
          bestMatch.title = verification.nameFound;
        }

        scoredResults = scoredResults.sort((a, b) => b.score - a.score);
      }
    }

    // Calculate final confidence
    if (bestMatch && status !== 'resolved') {
      const maxScore = verification?.verified
        ? 130
        : inputType === 'MORNINGSTAR_ID'
          ? 130 // Higher max score for Morningstar ID matches
          : inputType === 'TICKER'
            ? 70
            : 80;
      confidence = Math.min(bestMatch.score / maxScore, 1);

      // Check if this is a fund with "F" ID that we prioritized from multiple same-name results
      const isPrioritizedFund =
        bestMatch.assetType === 'Fondo' &&
        bestMatch.morningstarId?.toUpperCase().startsWith('F') &&
        scoredResults.some(
          (r) =>
            r !== bestMatch &&
            r.title &&
            this.normalizeInput(r.title) ===
              this.normalizeInput(bestMatch.title || ''),
        );

      if (verification?.verified) {
        status = 'resolved';
        confidence = Math.max(confidence, 0.95);
      } else if (isPrioritizedFund && bestMatch.morningstarId) {
        // Automatically resolve funds with "F" ID when we've prioritized them from same-name results
        status = 'resolved';
        confidence = Math.max(confidence, 0.85);
        this.logger.log(
          `Auto-resolving fund with "F" ID from multiple same-name results: ${bestMatch.morningstarId}`,
        );
      } else if (
        confidence >= this.config.minConfidence &&
        bestMatch.morningstarId
      ) {
        status = 'resolved';
      } else if (bestMatch.morningstarId) {
        status = 'needs_review';
      } else if (confidence >= 0.5) {
        status = 'needs_review';
      }
    }

    // Get the final best match (could be updated via synthetic match)
    const finalBestMatch = scoredResults[0] || bestMatch || null;

    const result: ResolutionResult = {
      input,
      inputType,
      normalizedInput,
      timestamp: new Date().toISOString(),
      status,
      confidence,
      bestMatch: finalBestMatch,
      allResults: scoredResults,
      morningstarId: finalBestMatch?.morningstarId || null,
      morningstarUrl: finalBestMatch?.url || null,
      verification,
    };

    this.logger.log(
      `Resolution complete: status=${status}, confidence=${(confidence * 100).toFixed(1)}%, morningstarId=${result.morningstarId}`,
    );

    return result;
  }
}
