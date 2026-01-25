import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import {
  InputType,
  SearchResult,
  ScoredResult,
  ResolutionResult,
  ResolverConfig,
  VerificationResult,
  AssetType
} from './types';

// Chalk v4 para colores (CommonJS compatible)
const chalk = require('chalk');

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG: ResolverConfig = {
  searchDelay: 500,  // Reducido para tests más rápidos
  maxResults: 10,
  minConfidence: 0.7,
  domains: ['morningstar.com', 'morningstar.es', 'global.morningstar.com']
};

// ============================================
// 1️⃣ NORMALIZACIÓN DE INPUT
// ============================================
function normalizeInput(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, ' ');
}

function classifyInput(input: string): InputType {
  const normalized = normalizeInput(input);
  
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
// 2️⃣ EXTRACCIÓN DE MORNINGSTAR ID
// ============================================
function extractMorningstarId(url: string): string | null {
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

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

// ============================================
// 3️⃣ SISTEMA DE SCORING (MEJORADO)
// ============================================
function scoreResult(
  result: SearchResult,
  originalInput: string,
  inputType: InputType
): ScoredResult {
  const breakdown = {
    isinMatch: 0,
    tickerMatch: 0,
    nameMatch: 0,
    morningstarDomain: 0,
    typeMatch: 0
  };
  
  const textToSearch = `${result.title} ${result.snippet} ${result.url}`.toUpperCase();
  const normalizedInput = normalizeInput(originalInput);
  
  // +50 si el ISIN aparece en el resultado
  if (inputType === 'ISIN' && textToSearch.includes(normalizedInput)) {
    breakdown.isinMatch = 50;
  }
  
  // +40 si el ticker coincide exactamente (NUEVO)
  if (inputType === 'TICKER') {
    // Buscar ticker exacto en el título o snippet
    const tickerPattern = new RegExp(`\\b${normalizedInput}\\b`, 'i');
    const tickerValue = typeof result.ticker === 'string' ? result.ticker.toUpperCase() : '';
    if (tickerPattern.test(result.title) || tickerValue === normalizedInput) {
      breakdown.tickerMatch = 40;
    }
  }
  
  // +30 si hay coincidencia parcial de nombre (para FREE_TEXT)
  if (inputType === 'FREE_TEXT') {
    const words = normalizedInput.split(' ').filter(w => w.length > 3);
    const matchedWords = words.filter(w => textToSearch.includes(w));
    breakdown.nameMatch = Math.round((matchedWords.length / Math.max(words.length, 1)) * 30);
  }
  
  // +20 si es dominio morningstar
  if (CONFIG.domains.some(d => result.domain.includes(d.replace('www.', '')))) {
    breakdown.morningstarDomain = 20;
  }
  
  // +10 si tiene un Morningstar ID válido extraído
  if (result.morningstarId) {
    breakdown.typeMatch = 10;
  }
  
  const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);
  
  return {
    ...result,
    score: totalScore,
    scoreBreakdown: breakdown
  };
}

// ============================================
// 4️⃣ BÚSQUEDA EN MORNINGSTAR
// ============================================

// Mapeo de tipos de Morningstar a nuestros tipos
const MORNINGSTAR_TYPE_MAP: Record<string, AssetType> = {
  'FO': 'Fondo',     // Fund
  'FE': 'Fondo',     // Fund (otra variante)
  'FC': 'Fondo',     // Fund Class
  'CE': 'ETF',       // Collective Investment (ETF)
  'ET': 'ETF',       // ETF
  'ST': 'Accion',    // Stock
  'EQ': 'Accion',    // Equity
  'IX': 'Fondo',     // Index Fund
};

function mapMorningstarType(rawType: string | undefined): AssetType {
  if (!rawType) return 'Desconocido';
  const upperType = rawType.toUpperCase();
  return MORNINGSTAR_TYPE_MAP[upperType] || 'Desconocido';
}

// Genera la URL correcta según el tipo de activo
function buildMorningstarUrl(id: string, assetType: AssetType = 'Fondo'): string {
  // Map asset type to URL path segments
  const pathMap: Record<AssetType, string> = {
    ETF: 'etfs',
    Fondo: 'fondos',
    Accion: 'acciones',
    Desconocido: 'fondos', // Default to funds for unknown
  };

  const path = pathMap[assetType] || 'fondos';
  return `https://global.morningstar.com/es/inversiones/${path}/${id}/cotizacion`;
}

// Estrategia A: API de búsqueda de Morningstar.es (¡LA MEJOR!)
async function searchMorningstarAPI(query: string): Promise<SearchResult[]> {
  console.log(chalk.gray(`  🔍 [API] Buscando en Morningstar API...`));
  
  const endpoint = `https://www.morningstar.es/es/util/SecuritySearch.ashx?q=${encodeURIComponent(query)}&limit=10&preferedList=`;
  
  try {
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Referer': 'https://www.morningstar.es/',
      }
    });
    
    if (!response.ok) return [];
    
    const text = await response.text();
    const results: SearchResult[] = [];
    const jsonMatches = text.match(/\{[^{}]+\}/g);
    
    if (jsonMatches) {
      for (const jsonStr of jsonMatches) {
        try {
          const item = JSON.parse(jsonStr);
          // Priorizar formato 0P (PerformanceId) sobre F0 (SecId)
          // El formato 0P es más usado en APIs y X-Ray de Morningstar
          const performanceId = item.i;  // Formato 0P0001DWN7
          const secId = item.pi;         // Formato F000010QGL
          const principalId = (performanceId && performanceId.startsWith('0P')) 
            ? performanceId 
            : (secId || item.i);
          const secondaryId = secId !== principalId ? secId : null;
          
          // Extraer tipo de activo
          const rawType = item.tt || item.Type || item.type;
          const securityType = item.t || item.tt || item.Type || 2;
          const isStock = securityType === 3 || securityType === '3';
          
          // IMPORTANTE: Priorizar rawType (CE/ET) para detectar ETFs
          // Algunos ETPs/ETFs pueden tener securityType=3 (stock) porque cotizan en bolsa
          // pero rawType los identifica correctamente como CE (Collective Investment/ETF)
          const isETF = rawType === 'CE' || rawType === 'ET';
          const detectedAssetType: AssetType = isETF
            ? 'ETF'
            : isStock
              ? 'Accion'
              : 'Fondo';
          
          if (principalId) {
            console.log(chalk.gray(`  📄 [API] Encontrado: ${item.n} (ID: ${principalId}, Tipo: ${detectedAssetType})`));
            
            const tickerString = typeof item.ticker === 'string' ? item.ticker : undefined;
            
            results.push({
              url: buildMorningstarUrl(principalId, detectedAssetType),
              title: item.n || '',
              snippet: `ID Principal: ${principalId} | Tipo: ${detectedAssetType}`,
              morningstarId: principalId,
              domain: 'global.morningstar.com',
              ticker: tickerString,
              assetType: detectedAssetType,
              rawType: rawType
            });
            
            // Si hay ID secundario diferente (el SecId), añadirlo como alternativo
            if (secondaryId) {
              results.push({
                url: buildMorningstarUrl(secondaryId, detectedAssetType),
                title: item.n || '',
                snippet: `ID Secundario: ${secondaryId} | Tipo: ${detectedAssetType}`,
                morningstarId: secondaryId,
                domain: 'global.morningstar.com',
                ticker: tickerString,
                assetType: detectedAssetType,
                rawType: rawType
              });
            }
          }
        } catch {
          // Ignorar JSON inválido
        }
      }
    }
    
    if (results.length > 0) {
      console.log(chalk.green(`  ✅ [API] Encontrados: ${results.length} resultados`));
      return results;
    }
  } catch (error) {
    console.log(chalk.gray(`  ⚠️ [API] Error: ${error}`));
  }
  
  return [];
}

// Estrategia B: Scraping de página de búsqueda morningstar.es
async function searchMorningstarHTML(query: string): Promise<SearchResult[]> {
  console.log(chalk.gray(`  🔍 [HTML] Scraping página de búsqueda...`));
  
  const searchUrls = [
    `https://www.morningstar.es/es/funds/SecuritySearchResults.aspx?search=${encodeURIComponent(query)}&type=`,
  ];
  
  for (const searchUrl of searchUrls) {
    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-ES,es;q=0.9',
        }
      });
      
      if (!response.ok) continue;
      
      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];
      
      $('a[href*="id="], a[href*="/funds/"], a[href*="/fondos/"], a[href*="/etf/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        
        if (href && text) {
          const id = extractMorningstarId(href);
          if (id) {
            const fullUrl = href.startsWith('http') ? href : `https://www.morningstar.es${href}`;
            results.push({
              url: fullUrl,
              title: text,
              snippet: '',
              morningstarId: id,
              domain: extractDomain(fullUrl)
            });
          }
        }
      });
      
      if (results.length > 0) {
        console.log(chalk.gray(`  📄 [HTML] Encontrados: ${results.length}`));
        return results.slice(0, 5);
      }
    } catch (error) {
      console.log(chalk.gray(`  ⚠️ [HTML] Error: ${error}`));
    }
  }
  
  return [];
}

// Estrategia C: APIs de Global Morningstar (backup)
async function searchGlobalMorningstar(query: string): Promise<SearchResult[]> {
  console.log(chalk.gray(`  🔍 [GLOBAL] Buscando en global.morningstar.com...`));
  
  const endpoints = [
    `https://global.morningstar.com/api/v1/security/search?q=${encodeURIComponent(query)}&languageId=es-ES&countryId=ES`,
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://global.morningstar.com',
          'Referer': 'https://global.morningstar.com/',
        }
      });
      
      if (!response.ok) continue;
      
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        
        if (Array.isArray(data) && data.length > 0) {
          console.log(chalk.gray(`  📄 [GLOBAL] Encontrados: ${data.length}`));
          return data.slice(0, 5).map((item: any) => ({
            url: `https://global.morningstar.com/es/inversiones/fondos/${item.securityId || item.id}/cotizacion`,
            title: item.name || item.legalName || '',
            snippet: `${item.isin || ''} | ${item.ticker || ''}`,
            morningstarId: item.securityId || item.id || null,
            domain: 'global.morningstar.com',
            ticker: item.ticker || undefined
          }));
        }
      } catch {
        // No es JSON válido
      }
    } catch {
      // Continuar con siguiente endpoint
    }
  }
  
  console.log(chalk.gray(`  ⚠️ [GLOBAL] Sin resultados de API`));
  return [];
}

// Estrategia D: DuckDuckGo (fallback)
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  console.log(chalk.gray(`  🔍 [DDG] Buscando en DuckDuckGo...`));
  
  const searchQuery = `site:global.morningstar.com/*/inversiones/fondos "${query}"`;
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
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
        const id = extractMorningstarId(url);
        results.push({
          url,
          title,
          snippet,
          morningstarId: id,
          domain: extractDomain(url)
        });
      }
    });
    
    if (results.length > 0) {
      console.log(chalk.gray(`  📄 [DDG] Encontrados: ${results.length}`));
      return results;
    }
  } catch (error) {
    console.log(chalk.gray(`  ⚠️ [DDG] Error: ${error}`));
  }
  
  return [];
}

// ============================================
// 4.5️⃣ VERIFICACIÓN DE ISIN EN PÁGINA
// ============================================
async function verifyFundPage(url: string, expectedIsin: string): Promise<VerificationResult> {
  console.log(chalk.gray(`  🔎 [VERIFY] Verificando página...`));
  
  const result: VerificationResult = {
    verified: false,
    isinFound: null,
    nameFound: null,
    additionalInfo: {}
  };
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9',
      }
    });
    
    if (!response.ok) {
      console.log(chalk.gray(`  ⚠️ [VERIFY] HTTP ${response.status}`));
      return result;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    const pageText = $('body').text();
    
    // Buscar ISIN en el HTML
    const isinPatterns = [
      /ISIN[:\s]*([A-Z]{2}[A-Z0-9]{10})/gi,
      /\b([A-Z]{2}[A-Z0-9]{10})\b/g,
    ];
    
    for (const pattern of isinPatterns) {
      const matches = pageText.match(pattern);
      if (matches) {
        for (const match of matches) {
          const isinMatch = match.match(/([A-Z]{2}[A-Z0-9]{10})/);
          if (isinMatch) {
            const foundIsin = isinMatch[1].toUpperCase();
            result.isinFound = foundIsin;
            
            if (foundIsin === expectedIsin.toUpperCase()) {
              result.verified = true;
              console.log(chalk.green(`  ✅ [VERIFY] ISIN confirmado: ${foundIsin}`));
              break;
            }
          }
        }
        if (result.verified) break;
      }
    }
    
    // Extraer nombre del fondo
    const nameSelectors = ['h1', '.security-name', '[data-testid="security-name"]', '.fund-name', 'title'];
    for (const selector of nameSelectors) {
      const name = $(selector).first().text().trim();
      if (name && name.length > 3 && name.length < 200) {
        result.nameFound = name.replace(/\s+/g, ' ').trim();
        break;
      }
    }
    
    // Info adicional
    const infoPatterns: Record<string, RegExp> = {
      'ticker': /(?:Ticker|Symbol)[:\s]*([A-Z0-9]{1,10})/i,
      'category': /(?:Categoría|Category)[:\s]*([^\n\r<]{3,50})/i,
      'currency': /(?:Divisa|Currency)[:\s]*([A-Z]{3})/i,
    };
    
    for (const [key, pattern] of Object.entries(infoPatterns)) {
      const match = pageText.match(pattern);
      if (match?.[1]) {
        result.additionalInfo[key] = match[1].trim();
      }
    }
    
    if (!result.verified && result.isinFound) {
      console.log(chalk.yellow(`  ⚠️ [VERIFY] ISIN encontrado (${result.isinFound}) no coincide con esperado (${expectedIsin})`));
    } else if (!result.isinFound) {
      console.log(chalk.gray(`  ⚠️ [VERIFY] No se encontró ISIN en la página`));
    }
    
  } catch (error) {
    console.log(chalk.gray(`  ⚠️ [VERIFY] Error: ${error}`));
  }
  
  return result;
}

// ============================================
// 5️⃣ BÚSQUEDA COMBINADA (PRIORIDAD CORREGIDA)
// ============================================
async function searchAll(query: string): Promise<SearchResult[]> {
  // Ejecutar todas las estrategias en paralelo
  const [apiResults, globalResults, ddgResults] = await Promise.all([
    searchMorningstarAPI(query),    // ← La mejor, va primero
    searchGlobalMorningstar(query),
    searchDuckDuckGo(query),
  ]);
  
  // PRIORIDAD CORREGIDA: API primero (es la que mejor funciona)
  const allResults: SearchResult[] = [
    ...apiResults,      // ← Primero los de la API (mejor fuente)
    ...globalResults,
    ...ddgResults,
  ];
  
  // Si no encontramos nada, intentar HTML scraping
  if (allResults.length === 0) {
    const htmlResults = await searchMorningstarHTML(query);
    allResults.push(...htmlResults);
  }
  
  // Deduplicar por Morningstar ID
  const seen = new Set<string>();
  const unique = allResults.filter(r => {
    if (!r.morningstarId) return true;
    if (seen.has(r.morningstarId)) return false;
    seen.add(r.morningstarId);
    return true;
  });
  
  console.log(chalk.gray(`  📊 Total resultados únicos: ${unique.length}`));
  
  return unique.slice(0, CONFIG.maxResults);
}

// ============================================
// 6️⃣ RESOLVER PRINCIPAL
// ============================================
async function resolveAsset(input: string): Promise<ResolutionResult> {
  const normalizedInput = normalizeInput(input);
  const inputType = classifyInput(normalizedInput);
  
  console.log(chalk.cyan(`\n📊 Procesando: ${chalk.bold(input)}`));
  console.log(chalk.gray(`   Tipo detectado: ${inputType}`));
  
  // Buscar usando todas las estrategias
  const searchResults = await searchAll(normalizedInput);
  
  // Scoring inicial
  let scoredResults = searchResults
    .map(r => scoreResult(r, input, inputType))
    .sort((a, b) => b.score - a.score);
  
  // Determinar estado inicial
  let bestMatch = scoredResults[0] || null;
  let status: 'resolved' | 'needs_review' | 'not_found' = 'not_found';
  let confidence = 0;
  let verification: VerificationResult | undefined = undefined;
  
  // Si tenemos un candidato con Morningstar ID y es ISIN, VERIFICAR
  if (bestMatch?.morningstarId && inputType === 'ISIN') {
    verification = await verifyFundPage(bestMatch.url, normalizedInput);
    
    if (verification.verified) {
      bestMatch.score += 50;
      bestMatch.scoreBreakdown.isinMatch = 50;
      
      if (verification.nameFound) {
        bestMatch.title = verification.nameFound;
      }
      
      scoredResults = scoredResults.sort((a, b) => b.score - a.score);
    }
  }
  
  // Calcular confianza final
  if (bestMatch) {
    // Max score: 80 (sin verify), 130 (con verify ISIN), 70 (ticker)
    const maxScore = verification?.verified ? 130 : (inputType === 'TICKER' ? 70 : 80);
    confidence = Math.min(bestMatch.score / maxScore, 1);
    
    if (verification?.verified) {
      status = 'resolved';
      confidence = Math.max(confidence, 0.95);
    } else if (confidence >= CONFIG.minConfidence && bestMatch.morningstarId) {
      status = 'resolved';
    } else if (bestMatch.morningstarId) {
      status = 'needs_review';
    } else if (confidence >= 0.5) {
      status = 'needs_review';
    }
  }
  
  const result: ResolutionResult = {
    input,
    inputType,
    normalizedInput,
    timestamp: new Date().toISOString(),
    status,
    confidence,
    bestMatch,
    allResults: scoredResults,
    morningstarId: bestMatch?.morningstarId || null,
    morningstarUrl: bestMatch?.url || null,
    verification  // ← Ahora tipado correctamente
  };
  
  printResult(result);
  
  return result;
}

// ============================================
// 7️⃣ OUTPUT
// ============================================
function printResult(result: ResolutionResult): void {
  const statusColors = {
    resolved: chalk.green,
    needs_review: chalk.yellow,
    not_found: chalk.red
  };
  
  const statusEmoji = {
    resolved: '✅',
    needs_review: '⚠️',
    not_found: '❌'
  };
  
  console.log('');
  console.log(statusColors[result.status](`   ${statusEmoji[result.status]} Estado: ${result.status.toUpperCase()}`));
  console.log(chalk.white(`   📈 Confianza: ${(result.confidence * 100).toFixed(1)}%`));
  
  if (result.morningstarId) {
    console.log(chalk.green(`   🆔 Morningstar ID: ${chalk.bold(result.morningstarId)}`));
  }
  
  // Mostrar tipo de activo
  if (result.bestMatch?.assetType) {
    const typeEmoji = {
      'Fondo': '📁',
      'ETF': '📊',
      'Accion': '📈',
      'Desconocido': '❓'
    };
    console.log(chalk.magenta(`   ${typeEmoji[result.bestMatch.assetType]} Tipo: ${result.bestMatch.assetType}`));
  }
  
  if (result.morningstarUrl) {
    console.log(chalk.blue(`   🔗 URL: ${result.morningstarUrl}`));
  }
  
  // Mostrar verificación
  if (result.verification) {
    if (result.verification.verified) {
      console.log(chalk.green.bold(`   ✓ VERIFICADO: ISIN confirmado en página`));
    }
    if (result.verification.nameFound) {
      console.log(chalk.white(`   📛 Nombre: ${result.verification.nameFound.slice(0, 60)}${result.verification.nameFound.length > 60 ? '...' : ''}`));
    }
    if (Object.keys(result.verification.additionalInfo).length > 0) {
      const info = Object.entries(result.verification.additionalInfo)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
      console.log(chalk.gray(`   📋 Info: ${info}`));
    }
  }
  
  if (result.bestMatch) {
    const maxScore = result.verification?.verified ? 130 : (result.inputType === 'TICKER' ? 70 : 80);
    console.log(chalk.gray(`   📊 Score: ${result.bestMatch.score}/${maxScore}`));
    console.log(chalk.gray(`      - ISIN match: ${result.bestMatch.scoreBreakdown.isinMatch}${result.verification?.verified ? ' (verificado)' : ''}`));
    if (result.inputType === 'TICKER') {
      console.log(chalk.gray(`      - Ticker match: ${result.bestMatch.scoreBreakdown.tickerMatch}`));
    }
    console.log(chalk.gray(`      - Domain: ${result.bestMatch.scoreBreakdown.morningstarDomain}`));
    console.log(chalk.gray(`      - Type: ${result.bestMatch.scoreBreakdown.typeMatch}`));
  }
  
  if (result.allResults.length > 1) {
    console.log(chalk.gray(`\n   📋 Otros resultados (${result.allResults.length - 1}):`));
    result.allResults.slice(1, 4).forEach((r, i) => {
      const title = r.title ? r.title.slice(0, 40) + '...' : 'N/A';
      console.log(chalk.gray(`      ${i + 2}. ${r.morningstarId || 'N/A'} - ${title} (score: ${r.score})`));
    });
  }
}

function saveResults(results: ResolutionResult[], filename: string): void {
  const resultsDir = path.join(process.cwd(), 'results');
  
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const filepath = path.join(resultsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf-8');
  
  console.log(chalk.green(`\n💾 Resultados guardados en: ${filepath}`));
}

// ============================================
// 8️⃣ MAIN
// ============================================
async function main(): Promise<void> {
  console.log(chalk.cyan.bold('\n🧠 ISIN → Morningstar Resolver (POC v4)\n'));
  console.log(chalk.gray('=' .repeat(50)));
  console.log(chalk.gray('Estrategias: API (prioritaria) + Global + DuckDuckGo + HTML'));
  
  // Test - IDs del usuario para X-Ray
  const testInputs = [
    '0P000003RE',
    '0P000002HD',
    '0P000000B7',
    'F0GBR04UOL',
    '0P000000H9',
    '0P0000L2QW',
  ];
  
  console.log(chalk.white(`\n📋 Inputs a procesar: ${testInputs.length}`));
  testInputs.forEach((input, i) => {
    console.log(chalk.gray(`   ${i + 1}. ${input}`));
  });
  
  const results: ResolutionResult[] = [];
  
  for (const input of testInputs) {
    const result = await resolveAsset(input);
    results.push(result);
    
    if (testInputs.indexOf(input) < testInputs.length - 1) {
      console.log(chalk.gray(`\n   ⏳ Esperando ${CONFIG.searchDelay / 1000}s...`));
      await new Promise(r => setTimeout(r, CONFIG.searchDelay));
    }
  }
  
  // Guardar
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  saveResults(results, `resolution-${timestamp}.json`);
  
  // Resumen
  console.log(chalk.cyan.bold('\n📊 RESUMEN FINAL'));
  console.log(chalk.gray('=' .repeat(50)));
  
  const resolved = results.filter(r => r.status === 'resolved').length;
  const needsReview = results.filter(r => r.status === 'needs_review').length;
  const notFound = results.filter(r => r.status === 'not_found').length;
  
  console.log(chalk.green(`   ✅ Resueltos: ${resolved}`));
  console.log(chalk.yellow(`   ⚠️ Necesitan revisión: ${needsReview}`));
  console.log(chalk.red(`   ❌ No encontrados: ${notFound}`));
  console.log(chalk.gray('\n👋 Proceso finalizado.\n'));
}

main();
