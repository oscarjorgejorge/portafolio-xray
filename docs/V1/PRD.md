# Portfolio X-Ray Generator — PRD V1

## Overview

**Product:** Web application to generate Morningstar X-Ray portfolio analysis reports  
**Target User:** Individual retail investors  
**Success Metric:** Number of X-Rays generated

---

## Problem Statement

Generating Morningstar X-Ray reports currently requires:
- Manual ISIN → Morningstar ID lookup (per asset)
- Complex Excel formulas that frequently break
- Tedious, error-prone process

**Goal:** Reduce X-Ray generation from ~30 minutes to < 1 minute.

---

## Core Features (V1)

### 1. Portfolio Input
- Accept **ISIN** or **Morningstar code**
- Two input modes: text area (paste) or table UI
- Allocation: **percentage** (must = 100%) or **absolute amounts**
- Unlimited assets

### 2. Asset Resolution Engine
- Auto-resolve ISIN → Morningstar ID
- Cache resolved assets in database (system learns over time)
- Confidence scoring with visual feedback for uncertain matches
- Resolution states: *to be defined during implementation*

### 3. Validation UX
- Show asset name + type after each input
- Low confidence: display alternatives to pick from
- Manual override: allow direct Morningstar ID input

### 4. X-Ray Generation
- Build Morningstar X-Ray URL from resolved codes
- Output: copyable link + "Open PDF" button

### 5. Shareable URL
- Encode portfolio in URL query params
- Format: `app.com/xray?assets=ISIN:40,ISIN:30`
- No database storage required for portfolios

---

## Out of Scope (V1)

| Feature | Version |
|---------|---------|
| User accounts | V2 |
| Save portfolios | V2 |
| Asset search by name | V2 |
| Community features | V2+ |
| Custom PDF generation | V2+ |

---

## User Flow

```
1. User opens app
2. Enters assets (ISIN + weight)
3. System validates each asset (shows name)
4. If low confidence → pick from alternatives
5. When all valid + total = 100% → Generate
6. User sees Morningstar URL + Open button
7. User can copy shareable link
```

---

## Technical Requirements

| Component | Technology |
|-----------|------------|
| Frontend | Web (React/Next.js recommended) |
| Backend | API (NestJS recommended) |
| Database | PostgreSQL (asset cache) |
| Resolution | Web scraping + pattern matching |

---

## Data Model (V1)

```typescript
// Asset = Financial instrument (resolution cache)
// This is the ONLY entity needed for V1
interface Asset {
  id: string;
  isin: string;
  morningstarId: string;
  name: string;
  type: 'ETF' | 'FUND' | 'STOCK' | 'ETC';
  confidence: number;
  source: 'manual' | 'web_search' | 'imported';
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Note: XRay and XRayAsset are V2 entities (when users can save X-Rays)
```

---

## Success Criteria

- [ ] User can input portfolio in < 2 minutes
- [ ] ISIN resolution success rate > 90%
- [ ] Generated URL opens valid Morningstar PDF
- [ ] Shareable URL recreates same portfolio

---

## Deferred Decisions

| Topic | Notes |
|-------|-------|
| **Tracking/Analytics** | Decide after V1: auth-based tracking for logged users + solution for anonymous users |
| **Resolution states** | Define exact states and thresholds during implementation |

