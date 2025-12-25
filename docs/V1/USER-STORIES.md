# Portfolio X-Ray Generator — User Stories V1

## Epic: Portfolio X-Ray Generation

As a **retail investor**, I want to generate Morningstar X-Ray reports easily, so that I can analyze my portfolio composition without manual Excel work.

---

## User Stories

### US-01: Add Asset by ISIN

**Story:**
> As a user, I want to add an asset to my portfolio by entering its ISIN code, so that I don't need to manually look up Morningstar IDs.

**Acceptance Criteria:**
- [ ] Input field accepts ISIN format (2 letters + 10 alphanumeric)
- [ ] System validates ISIN format before submission
- [ ] Invalid format shows clear error message
- [ ] Valid ISIN triggers resolution process
- [ ] Loading state shown during resolution

**Priority:** High  
**Points:** 5  
**Related UC:** UC-01

---

### US-02: Add Asset by Morningstar ID

**Story:**
> As a user who knows the Morningstar code, I want to enter it directly, so that I can skip the resolution process.

**Acceptance Criteria:**
- [ ] Input field accepts Morningstar ID format (0P000... or F000...)
- [ ] System detects Morningstar ID format automatically
- [ ] Direct lookup in cache or validation against Morningstar
- [ ] Asset details displayed for confirmation

**Priority:** High  
**Points:** 3  
**Related UC:** UC-01, UC-04

---

### US-03: View Resolved Asset Details

**Story:**
> As a user, I want to see the resolved asset name and type after entering an ISIN, so that I can confirm it's the correct instrument.

**Acceptance Criteria:**
- [ ] Display asset name (e.g., "Vanguard S&P 500 UCITS ETF")
- [ ] Display asset type (ETF, Fund, Stock)
- [ ] Display ISIN for reference
- [ ] Show confidence indicator if auto-resolved
- [ ] Option to change/remove asset

**Priority:** High  
**Points:** 3  
**Related UC:** UC-01

---

### US-04: Handle Failed Resolution

**Story:**
> As a user, when the system cannot resolve my ISIN, I want to be prompted to find and enter the Morningstar ID manually so that I can complete my portfolio.

**Acceptance Criteria:**
- [ ] Show clear message: "Could not resolve this ISIN"
- [ ] Provide link to Morningstar website for manual lookup
- [ ] Show input field for manual Morningstar ID entry
- [ ] Tip: "Find your asset on morningstar.com and copy the ID from the URL"
- [ ] Manual entry saved to cache for future use

**Priority:** Medium  
**Points:** 3  
**Related UC:** UC-03, UC-04

---

### US-05: Manual Morningstar ID Override

**Story:**
> As a user, when auto-resolution fails, I want to manually enter the Morningstar ID so that I'm not blocked from completing my portfolio.

**Acceptance Criteria:**
- [ ] "Enter manually" option shown when resolution fails
- [ ] Input field for Morningstar ID
- [ ] System validates ID format
- [ ] System validates ID exists on Morningstar (optional)
- [ ] Manual entry saved to cache with `source: manual`

**Priority:** Medium  
**Points:** 3  
**Related UC:** UC-04

---

### US-06: Set Asset Weight (Percentage)

**Story:**
> As a user, I want to set each asset's weight as a percentage so that I can define my portfolio allocation.

**Acceptance Criteria:**
- [ ] Percentage input field per asset
- [ ] Accept values 0-100
- [ ] Show running total of all percentages
- [ ] Warning when total ≠ 100%
- [ ] Cannot generate X-Ray until total = 100%

**Priority:** High  
**Points:** 3  
**Related UC:** UC-05

---

### US-07: Set Asset Weight (Amount)

**Story:**
> As a user, I want to enter absolute amounts instead of percentages so that I can use the actual values from my portfolio.

**Acceptance Criteria:**
- [ ] Toggle between "Percentage" and "Amount" mode
- [ ] Amount input field per asset (€, $, etc.)
- [ ] System calculates percentages automatically
- [ ] Display calculated percentage next to amount
- [ ] All amounts must be > 0

**Priority:** Medium  
**Points:** 3  
**Related UC:** UC-05

---

### US-08: Add Multiple Assets

**Story:**
> As a user, I want to add multiple assets to my portfolio so that I can generate a complete X-Ray analysis.

**Acceptance Criteria:**
- [ ] "Add asset" button to add more rows
- [ ] No limit on number of assets
- [ ] Remove button per asset
- [ ] Reorder assets (optional, nice-to-have)
- [ ] Clear all button

**Priority:** High  
**Points:** 3  
**Related UC:** UC-01

---

### US-09: Generate Morningstar X-Ray URL

**Story:**
> As a user, after building my portfolio, I want to generate the X-Ray URL so that I can view the analysis on Morningstar.

**Acceptance Criteria:**
- [ ] "Generate X-Ray" button (enabled when valid)
- [ ] Button disabled with tooltip when invalid (total ≠ 100%, unresolved assets)
- [ ] System builds correct Morningstar URL with all IDs and weights
- [ ] Display generated URL (copyable)
- [ ] "Open X-Ray PDF" button opens Morningstar in new tab

**Priority:** High  
**Points:** 5  
**Related UC:** UC-06

---

### US-10: Copy Shareable Link

**Story:**
> As a user, I want to copy a shareable link to my portfolio configuration so that others can view the same X-Ray.

**Acceptance Criteria:**
- [ ] "Copy Link" button after generating X-Ray
- [ ] URL contains portfolio data in query params (`?assets=ISIN:40,ISIN:30`)
- [ ] Toast/notification confirms copy success
- [ ] Link works when pasted in browser

**Priority:** High  
**Points:** 3  
**Related UC:** UC-07

---

### US-11: Load Portfolio from Shared URL

**Story:**
> As a user, I want to open a shared portfolio link and have it pre-populated so that I can view or modify it.

**Acceptance Criteria:**
- [ ] Parse `?assets=...` query parameter on page load
- [ ] Resolve each asset (from cache or auto)
- [ ] Show loading state during resolution
- [ ] Pre-populate portfolio builder with assets + weights
- [ ] User can modify and regenerate

**Priority:** High  
**Points:** 5  
**Related UC:** UC-08

---

## Summary Table

| ID | Story | Priority | Points | UC |
|----|-------|----------|--------|-----|
| US-01 | Add asset by ISIN | High | 5 | UC-01 |
| US-02 | Add asset by Morningstar ID | High | 3 | UC-01, UC-04 |
| US-03 | View resolved asset details | High | 3 | UC-01 |
| US-04 | Handle failed resolution | Medium | 3 | UC-03, UC-04 |
| US-05 | Manual Morningstar ID override | Medium | 3 | UC-04 |
| US-06 | Set asset weight (percentage) | High | 3 | UC-05 |
| US-07 | Set asset weight (amount) | Medium | 3 | UC-05 |
| US-08 | Add multiple assets | High | 3 | UC-01 |
| US-09 | Generate Morningstar X-Ray URL | High | 5 | UC-06 |
| US-10 | Copy shareable link | High | 3 | UC-07 |
| US-11 | Load portfolio from shared URL | High | 5 | UC-08 |

---

## Total Points

| Priority | Stories | Points |
|----------|---------|--------|
| High | 8 | 30 |
| Medium | 3 | 9 |
| **Total** | **11** | **39** |

---

## Sprint Suggestion (V1)

### Sprint 1: Core Resolution (17 pts)
- US-01: Add asset by ISIN (5)
- US-02: Add asset by Morningstar ID (3)
- US-03: View resolved asset details (3)
- US-06: Set asset weight (percentage) (3)
- US-08: Add multiple assets (3)

### Sprint 2: Generation & Sharing (16 pts)
- US-09: Generate Morningstar X-Ray URL (5)
- US-10: Copy shareable link (3)
- US-11: Load portfolio from shared URL (5)
- US-07: Set asset weight (amount) (3)

### Sprint 3: Edge Cases & Polish (6 pts)
- US-04: Handle failed resolution (3)
- US-05: Manual Morningstar ID override (3)

