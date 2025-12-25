# Portfolio X-Ray Generator — Use Cases V1

## Actors

| Actor | Description |
|-------|-------------|
| **User** | Retail investor (anonymous, no auth required) |
| **System** | Backend resolution engine |

---

## UC-01: Add Asset to Portfolio

**Goal:** User adds an asset using ISIN or Morningstar code

**Precondition:** User is on portfolio builder page

**Flow:**
1. User enters identifier (ISIN or Morningstar code)
2. System normalizes input and detects type
3. System searches cache database
4. **If found:** Display asset name + type for confirmation
5. **If not found:** Trigger auto-resolution (UC-02)
6. User enters allocation (% or amount)
7. Asset added to portfolio list

**Postcondition:** Asset visible in portfolio with validation status

---

## UC-02: Auto-Resolve Unknown Asset

**Goal:** System resolves ISIN to Morningstar ID

**Trigger:** Asset not found in cache (from UC-01)

**Flow:**
1. System performs web search: `site:morningstar.com "ISIN"`
2. System extracts Morningstar ID from results
3. System validates match (ISIN appears on page, type coherent)
4. System calculates confidence score
5. **If high confidence:** Show resolved asset to user
6. **If low confidence:** Show alternatives (UC-03)
7. **If failed:** Prompt manual input (UC-04)
8. Save resolution to cache database

**Postcondition:** Asset resolved and cached for future use

---

## UC-03: Select from Alternatives

**Goal:** User picks correct asset when confidence is low

**Trigger:** Multiple candidates or low confidence match

**Flow:**
1. System displays list of possible matches with scores
2. User selects correct asset
3. System saves selection as `source: manual`
4. Continue with UC-01 step 6

**Postcondition:** Correct asset confirmed and cached

---

## UC-04: Manual Morningstar ID Input

**Goal:** User enters Morningstar ID directly when auto-resolution fails

**Trigger:** Resolution failed or user knows the code

**Flow:**
1. System shows "Enter Morningstar ID manually" option
2. User enters Morningstar ID
3. System validates ID exists on Morningstar
4. System saves to cache as `source: manual`
5. Continue with UC-01 step 6

**Postcondition:** Asset added via manual override

---

## UC-05: Set Allocation Mode

**Goal:** User chooses how to express portfolio weights

**Flow:**
1. User selects mode: **Percentage** or **Amount**
2. **Percentage mode:** Values must sum to 100%
3. **Amount mode:** System calculates percentages from total

**Validation:**
- Percentage mode: Block generation if total ≠ 100%
- Amount mode: All values must be > 0

---

## UC-06: Generate X-Ray URL

**Goal:** User generates Morningstar X-Ray link

**Precondition:** 
- At least 1 asset added
- All assets validated
- Allocation is valid (100% or amounts)

**Flow:**
1. User clicks "Generate X-Ray"
2. System builds Morningstar URL with all Morningstar IDs + weights
3. System displays:
   - Copyable URL text
   - "Open X-Ray PDF" button
4. User can copy link or open in new tab

**Postcondition:** Morningstar PDF accessible

---

## UC-07: Share Portfolio via URL

**Goal:** User gets shareable link to recreate portfolio

**Flow:**
1. User clicks "Share" or "Copy Link"
2. System generates URL with query params: `?assets=ISIN:40,ISIN:30`
3. User copies URL
4. When someone opens the URL → portfolio auto-populates

**Postcondition:** Portfolio shareable without database storage

---

## UC-08: Load Portfolio from Shared URL

**Goal:** User opens shared portfolio link

**Flow:**
1. User opens URL with `?assets=...` params
2. System parses query params
3. System resolves each ISIN (from cache or auto)
4. Portfolio builder pre-populated with assets
5. User can modify or generate directly

**Postcondition:** Shared portfolio loaded and editable

---

## Error Scenarios

| Scenario | System Response |
|----------|-----------------|
| Invalid ISIN format | Show format error, don't attempt resolution |
| Resolution timeout | Show error, offer manual input |
| Morningstar unavailable | Show error, suggest retry later |
| Total ≠ 100% (% mode) | Disable generate, show remaining % |

