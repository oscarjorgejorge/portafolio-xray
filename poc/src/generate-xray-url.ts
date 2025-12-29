/**
 * Generador de URLs de Morningstar X-Ray
 * 
 * Crea URLs para analizar carteras con el X-Ray de Morningstar
 */

interface PortfolioItem {
  morningstarId: string;
  name: string;
  type: 'Fondo' | 'Accion' | 'ETF';
  weight: number;  // Porcentaje (0-100)
}

// Códigos de Morningstar de las pruebas realizadas
const AVAILABLE_ASSETS: Omit<PortfolioItem, 'weight'>[] = [
  { morningstarId: 'F00000THA5', name: 'Federated Hermes Asia ex-Japan', type: 'Fondo' },
  { morningstarId: 'F000011G2R', name: 'Janus Henderson Biotechnology', type: 'Fondo' },
  { morningstarId: '0P000168Z7', name: 'BlackRock Strategic Funds', type: 'Fondo' },
  { morningstarId: '0P0001JIA2', name: 'DB Growth SAA (EUR) WAMC', type: 'Fondo' },
  { morningstarId: '0P0001EHST', name: 'Capital Group Capital Income Builder', type: 'Fondo' },
  { morningstarId: '0P0001F9QM', name: 'iShares MSCI EM Value Factor ETF', type: 'ETF' },
  { morningstarId: '0P0001DZSM', name: 'BNP Paribas Easy MSCI Emerging SRI', type: 'ETF' },
  { morningstarId: '0P000003X1', name: 'Nike Inc', type: 'Accion' },  // Corregido ID
  { morningstarId: '0P0000006A', name: 'Advanced Micro Devices (AMD)', type: 'Accion' },
  { morningstarId: '0P0000COVI', name: 'Celsius Holdings', type: 'Accion' },
  { morningstarId: '0P00018NVI', name: 'e.l.f. Beauty', type: 'Accion' },
  { morningstarId: '0P0000A5TF', name: 'Amper SA', type: 'Accion' },  // Corregido: es Acción, no Fondo
];

// Mapeo de tipo a código de Morningstar X-Ray
const TYPE_CODE: Record<string, string> = {
  'Fondo': '2',   // FOESP = Fondo España
  'ETF': '2',     // También usa 2
  'Accion': '3',  // E0WWE = Equity World
};

// Exchange codes por tipo
const EXCHANGE_CODE: Record<string, string> = {
  'Fondo': 'FOESP',
  'ETF': 'FOESP',
  'Accion': 'E0WWE',
};

/**
 * Genera pesos aleatorios que suman 100%
 */
function generateRandomWeights(count: number): number[] {
  const weights: number[] = [];
  let remaining = 100;
  
  for (let i = 0; i < count - 1; i++) {
    // Peso aleatorio entre 5% y el máximo disponible dividido por items restantes
    const maxWeight = Math.min(remaining - (count - i - 1) * 5, 35); // Max 35% por activo
    const minWeight = 5;
    const weight = Math.round((Math.random() * (maxWeight - minWeight) + minWeight) * 100) / 100;
    weights.push(weight);
    remaining -= weight;
  }
  
  // El último peso es lo que queda
  weights.push(Math.round(remaining * 100) / 100);
  
  // Mezclar para que no siempre el último sea pequeño
  return weights.sort(() => Math.random() - 0.5);
}

/**
 * Selecciona N activos aleatorios
 */
function selectRandomAssets(count: number): Omit<PortfolioItem, 'weight'>[] {
  const shuffled = [...AVAILABLE_ASSETS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Genera el token de seguridad para un activo
 * Formato: {ID}]2]0]{EXCHANGE}$$ALL_1340
 */
function generateSecurityToken(item: PortfolioItem): string {
  const typeCode = TYPE_CODE[item.type];
  const exchange = EXCHANGE_CODE[item.type];
  
  // Formato: ID]tipo]0]exchange$$ALL_1340
  return `${item.morningstarId}]${typeCode}]0]${exchange}$$ALL_1340`;
}

/**
 * Genera el peso en formato de URL (sin decimales, multiplicado por 100)
 * Ejemplo: 20.00% → 20000
 */
function generateWeightToken(weight: number): string {
  return Math.round(weight * 100).toString();
}

/**
 * Genera la URL completa de X-Ray
 * Formato correcto: SecurityTokenList=...&values=peso1|peso2|peso3...
 */
function generateXRayUrl(portfolio: PortfolioItem[]): string {
  const baseUrl = 'https://lt.morningstar.com/j2uwuwirpv/xraypdf/default.aspx';
  
  // Construir SecurityTokenList (tokens codificados separados por %7C)
  const securityTokenList = portfolio.map(item => {
    const token = generateSecurityToken(item);
    return encodeURIComponent(token);
  }).join('%7C');
  
  // Construir values (pesos * 100, separados por %7C)
  // Ejemplo: 20.00% → 20000, 15.85% → 15850
  const valuesList = portfolio.map(item => {
    return Math.round(item.weight * 100).toString();
  }).join('%7C');
  
  // URL final con SecurityTokenList Y values
  return `${baseUrl}?LanguageId=es-ES&PortfolioType=2&SecurityTokenList=${securityTokenList}&values=${valuesList}`;
}

/**
 * Genera una tabla de la cartera para mostrar
 */
function printPortfolioTable(portfolio: PortfolioItem[]): void {
  console.log('\n' + '='.repeat(100));
  console.log('📊 COMPOSICIÓN DE CARTERA GENERADA');
  console.log('='.repeat(100));
  
  console.log('\n| # | Nombre del fondo | Tipo | Código Morningstar | % cartera |');
  console.log('|---|------------------|------|-------------------|-----------|');
  
  portfolio.forEach((item, i) => {
    const name = item.name.slice(0, 35).padEnd(35);
    const type = item.type.padEnd(7);
    const id = item.morningstarId.padEnd(12);
    const weight = item.weight.toFixed(2).padStart(6) + '%';
    console.log(`| ${i + 1} | ${name} | ${type} | ${id} | ${weight} |`);
  });
  
  const totalWeight = portfolio.reduce((sum, item) => sum + item.weight, 0);
  console.log('|---|------------------|------|-------------------|-----------|');
  console.log(`| Σ | ${'TOTAL'.padEnd(35)} | ${''.padEnd(7)} | ${''.padEnd(12)} | ${totalWeight.toFixed(2).padStart(6)}% |`);
  console.log('');
}

/**
 * Genera los datos en formato similar al Excel
 */
function generateExcelFormat(portfolio: PortfolioItem[]): void {
  console.log('\n📋 DATOS PARA EXCEL:');
  console.log('─'.repeat(80));
  console.log('Nombre del fondo\tTipo\tCódigo Morningstar.es\t% cartera\tSubURLActivo\tSubURLPeso');
  
  portfolio.forEach(item => {
    const token = generateSecurityToken(item);
    const encodedToken = encodeURIComponent(token);
    const weightToken = generateWeightToken(item.weight) + '%7C';
    
    console.log(`${item.name}\t${item.type}\t${item.morningstarId}\t${item.weight.toFixed(2)}%\t${encodedToken}\t${weightToken}`);
  });
}

// ============================================
// MAIN
// ============================================
async function main(): Promise<void> {
  console.log('\n🎲 GENERADOR DE CARTERA ALEATORIA PARA MORNINGSTAR X-RAY\n');
  
  // Forzar inclusión de 0P0000A5TF
  const requiredAsset = AVAILABLE_ASSETS.find(a => a.morningstarId === '0P0000A5TF')!;
  const otherAssets = AVAILABLE_ASSETS.filter(a => a.morningstarId !== '0P0000A5TF');
  
  // Seleccionar número aleatorio de activos adicionales (entre 4 y 7)
  const additionalCount = Math.floor(Math.random() * 4) + 4; // 4-7 activos adicionales
  const assetCount = additionalCount + 1; // +1 por el requerido
  
  console.log(`📌 Seleccionando ${assetCount} activos (incluyendo 0P0000A5TF)...`);
  
  // Seleccionar activos adicionales aleatorios
  const shuffledOthers = [...otherAssets].sort(() => Math.random() - 0.5);
  const selectedAssets = [requiredAsset, ...shuffledOthers.slice(0, additionalCount)];
  const weights = generateRandomWeights(assetCount);
  
  const portfolio: PortfolioItem[] = selectedAssets.map((asset, i) => ({
    ...asset,
    weight: weights[i]
  }));
  
  // Ordenar por peso descendente
  portfolio.sort((a, b) => b.weight - a.weight);
  
  // Mostrar tabla
  printPortfolioTable(portfolio);
  
  // Generar URL
  const xrayUrl = generateXRayUrl(portfolio);
  
  console.log('🔗 URL GENERADA PARA MORNINGSTAR X-RAY:');
  console.log('─'.repeat(80));
  console.log(xrayUrl);
  console.log('');
  
  // Mostrar formato Excel
  generateExcelFormat(portfolio);
  
  // Guardar en archivo
  const output = {
    generatedAt: new Date().toISOString(),
    assetCount,
    portfolio,
    xrayUrl,
    totalWeight: portfolio.reduce((sum, item) => sum + item.weight, 0)
  };
  
  const fs = await import('fs');
  const path = await import('path');
  
  const outputPath = path.join(process.cwd(), 'results', 'portfolio-xray.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n💾 Guardado en: ${outputPath}`);
  console.log('\n✅ ¡Cartera generada exitosamente!\n');
}

main();

