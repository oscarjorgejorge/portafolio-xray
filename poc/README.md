# 🧠 ISIN → Morningstar Resolver (POC)

Prueba de concepto para resolver identificadores de activos financieros (ISIN, Ticker, Morningstar ID) a sus correspondientes IDs de Morningstar.

## 📋 Tabla de Contenidos

- [Problema que resuelve](#-problema-que-resuelve)
- [Arquitectura](#-arquitectura)
- [Flujo de resolución](#-flujo-de-resolución)
- [Tipos de input soportados](#-tipos-de-input-soportados)
- [Estrategias de búsqueda](#-estrategias-de-búsqueda)
- [Sistema de scoring](#-sistema-de-scoring)
- [Estados de resolución](#-estados-de-resolución)
- [Instalación y uso](#-instalación-y-uso)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Resultados de pruebas](#-resultados-de-pruebas)
- [Próximos pasos](#-próximos-pasos)

---

## 🎯 Problema que resuelve

**Dado un identificador imperfecto (ISIN, ticker, nombre), identificar de forma persistente y reutilizable un activo en Morningstar.**

### Principios de diseño:

| Principio | Descripción |
|-----------|-------------|
| **Determinista** | Mismo input → mismo output |
| **Cacheado** | Una vez resuelto, no vuelve a resolver |
| **Auditable** | Cada resolución tiene nivel de confianza |
| **Evolutivo** | Acepta incertidumbre (estado `needs_review`) |

---

## 🏗 Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     resolveAsset(input)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │ 1. Normalizar │ → trim, uppercase, clasificar tipo       │
│  └──────────────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ 2. Buscar    │ → API + Global + DuckDuckGo + HTML        │
│  └──────────────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ 3. Scoring   │ → Puntuar cada resultado                  │
│  └──────────────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ 4. Verificar │ → (Solo ISIN) Confirmar en página         │
│  └──────────────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ 5. Resultado │ → resolved / needs_review / not_found     │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de resolución

### Ejemplo con ISIN:

```
Input: "LU1820812136"
         │
         ▼
    Normalizar: "LU1820812136"
    Tipo: ISIN
         │
         ▼
    Buscar en API morningstar.es
         │
         ▼
    Respuesta: {
      "i": "F0000112TP",      ← ID secundario
      "pi": "0P0001EHST",     ← ID principal ⭐
      "n": "Capital Group Capital Income Builder (LUX) Z"
    }
         │
         ▼
    Scoring: Domain(+20) + Type(+10) = 30/80
         │
         ▼
    Verificar página → ¿ISIN en HTML?
         │
         ▼
    Resultado: {
      morningstarId: "0P0001EHST",
      nombre: "Capital Group...",
      status: "needs_review",
      confidence: 37.5%
    }
```

---

## 📊 Tipos de input soportados

| Tipo | Patrón | Ejemplo | Detección |
|------|--------|---------|-----------|
| **ISIN** | `XX` + 10 alfanum | `LU1820812136` | `/^[A-Z]{2}[A-Z0-9]{10}$/` |
| **MORNINGSTAR_ID** | `0P000...` o `F000...` | `0P0001DZSM` | `/^(0P000\|F000)[A-Z0-9]+$/` |
| **TICKER** | 1-5 letras | `NIKE`, `AMD` | `/^[A-Z]{1,5}$/` |
| **FREE_TEXT** | Otro | `"Vanguard S&P 500"` | Default |

---

## 🔍 Estrategias de búsqueda

El sistema ejecuta **4 estrategias en paralelo**:

### 1. API Morningstar.es ⭐ (La mejor)

```
GET https://www.morningstar.es/es/util/SecuritySearch.ashx?q={query}

Respuesta: "Nombre|{json}|Nombre2|{json2}..."

Campos importantes:
- "i"  → ID secundario (para morningstar.es)
- "pi" → ID principal (para global.morningstar.com) ⭐
- "n"  → Nombre del activo
```

### 2. API Global Morningstar

```
GET https://global.morningstar.com/api/v1/security/search?q={query}
```

### 3. DuckDuckGo (Fallback)

```
Busca: site:global.morningstar.com/*/inversiones/fondos "{query}"
Extrae: Morningstar IDs de las URLs encontradas
```

### 4. HTML Scraping (Último recurso)

```
Scraping de páginas de búsqueda de morningstar.es
```

### Prioridad de resultados:

```
1. API morningstar.es      ← Primero (más confiable)
2. API global.morningstar
3. DuckDuckGo
4. HTML scraping           ← Último recurso
```

---

## 📈 Sistema de scoring

Cada resultado recibe puntos según estos criterios:

| Criterio | Puntos | Condición |
|----------|--------|-----------|
| **ISIN match** | +50 | El ISIN aparece en título/snippet |
| **Ticker match** | +40 | El ticker coincide exactamente |
| **Dominio Morningstar** | +20 | URL es de morningstar.* |
| **Tiene ID válido** | +10 | Extrajo un Morningstar ID |

### Ejemplo de scoring:

```
Input: NIKE (ticker)

Resultado: "Nike Inc Class B"
  - ISIN match:    0  (no aplica)
  - Ticker match: 40  (contiene "NIKE")
  - Domain:       20  (global.morningstar.com)
  - Type:         10  (tiene ID)
  ─────────────────
  Total:          70/70 = 100% ✅
```

---

## 🚦 Estados de resolución

| Estado | Descripción | Confianza |
|--------|-------------|-----------|
| ✅ **resolved** | Encontrado y verificado | ≥70% |
| ⚠️ **needs_review** | Encontrado, requiere revisión manual | <70% |
| ❌ **not_found** | No se encontró ningún resultado | 0% |

### Lógica de decisión:

```typescript
if (verificado) {
  status = "resolved"       // ✅ ISIN confirmado en página
  confidence = 95%+
} 
else if (confidence >= 70% && tiene_ID) {
  status = "resolved"       // ✅ Alta confianza
} 
else if (tiene_ID) {
  status = "needs_review"   // ⚠️ Revisar manualmente
} 
else {
  status = "not_found"      // ❌ No encontrado
}
```

---

## 🚀 Instalación y uso

### Requisitos

- Node.js 18+
- npm

### Instalación

```bash
npm install
```

### Ejecución

```bash
npm run dev
```

### Modificar inputs de prueba

Editar `src/index.ts`, línea ~680:

```typescript
const testInputs = [
  'LU1820812136',    // ISIN
  'NIKE',            // Ticker
  '0P0001DZSM',      // Morningstar ID
];
```

---

## 📁 Estructura del proyecto

```
├── src/
│   ├── types.ts          # Interfaces TypeScript
│   │   ├── InputType
│   │   ├── SearchResult
│   │   ├── ScoredResult
│   │   ├── VerificationResult
│   │   └── ResolutionResult
│   │
│   └── index.ts          # Lógica principal
│       ├── normalizeInput()
│       ├── classifyInput()
│       ├── searchMorningstarAPI()    ⭐
│       ├── searchGlobalMorningstar()
│       ├── searchDuckDuckGo()
│       ├── searchMorningstarHTML()
│       ├── scoreResult()
│       ├── verifyFundPage()
│       ├── resolveAsset()            # Orquestador
│       └── main()
│
├── results/              # JSONs con resultados
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📊 Resultados de pruebas

### Inputs probados:

| Input | Tipo | Status | Confianza | Morningstar ID |
|-------|------|--------|-----------|----------------|
| IE00BBL4VX78 | ISIN | ✅ resolved | 95% | F00000THA5 |
| LU1897414303 | ISIN | ✅ resolved | 95% | F000011G2R |
| LU1241525184 | ISIN | ⚠️ needs_review | 37.5% | 0P000168Z7 |
| LU2132883187 | ISIN | ⚠️ needs_review | 37.5% | 0P0001JIA2 |
| LU1820812136 | ISIN | ⚠️ needs_review | 37.5% | 0P0001EHST |
| IE00BG0SKF03 | ISIN | ⚠️ needs_review | 37.5% | 0P0001F9QM |
| NIKE | TICKER | ✅ resolved | 100% | 0P0001UHI6 |
| AMD | TICKER | ⚠️ needs_review | 42.9% | 0P0000006A |
| CELH | TICKER | ⚠️ needs_review | 37.5% | 0P0000COVI |
| ELF | TICKER | ⚠️ needs_review | 37.5% | 0P00018NVI |
| 0P0001DZSM | MORNINGSTAR_ID | ⚠️ needs_review | 37.5% | 0P0001DZSM |

### Notas:

- **ISINs `resolved`**: La verificación encontró el ISIN en la página de morningstar.es
- **ISINs `needs_review`**: global.morningstar.com es una SPA, el ISIN no está en HTML estático
- **Todos los IDs encontrados son correctos**, independiente del status

---

## 🔮 Próximos pasos

### Implementación sugerida:

1. **Cache/Base de datos**
   ```
   assets: {
     isin: "LU1820812136",
     morningstarId: "0P0001EHST",
     nombre: "Capital Group...",
     confidence: 0.95,
     source: "api",
     resolvedAt: "2025-12-25"
   }
   ```

2. **Flujo con BD**
   ```
   Input → ¿Existe en BD? 
           │
           ├── Sí → Devolver cached
           │
           └── No → Resolver → Guardar → Devolver
   ```

3. **Interfaz de revisión**
   - Para items con `status: "needs_review"`
   - Usuario confirma/corrige manualmente
   - Se guarda con `source: "manual"`

4. **Mejoras de verificación**
   - Usar Puppeteer para páginas SPA
   - Verificar en múltiples dominios de Morningstar

---

## 📝 Licencia

POC para uso interno.

---

## 🤝 Contribuir

Este es un proyecto de prueba de concepto. Para sugerencias o mejoras, contactar al equipo de desarrollo.

