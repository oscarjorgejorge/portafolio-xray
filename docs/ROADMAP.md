# Portfolio X-Ray Generator — Product Roadmap

## Vision

A platform where retail investors can effortlessly generate, save, and share portfolio X-Ray analysis reports, building a collective knowledge base of investment strategies.

---

## Phases Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRODUCT ROADMAP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  V1 - MVP                    V2 - Users & Persistence      V3 - Community   │
│  ─────────────               ──────────────────────        ──────────────   │
│  • Portfolio builder         • Authentication              • Explore page   │
│  • ISIN resolution           • User profiles               • Favorites      │
│  • Generate X-Ray URL        • Save portfolios             • Comments       │
│  • Shareable links           • Portfolio history           • User following │
│  • Asset cache DB            • Private/Public toggle       • Trending       │
│                              • Analytics/Tracking                           │
│                                                                             │
│  ────────────►               ────────────►                 ────────────►    │
│  Focus: Utility              Focus: Retention              Focus: Growth    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## V1 — MVP (Utility)

**Goal:** Solve the core problem — make X-Ray generation effortless

| Feature | Status |
|---------|--------|
| Portfolio builder (ISIN + weight) | 🎯 Core |
| Asset resolution engine | 🎯 Core |
| Resolution cache database | 🎯 Core |
| Generate Morningstar URL | 🎯 Core |
| Shareable URL (query params) | 🎯 Core |
| Download/Open PDF | 🎯 Core |

**Success Metric:** X-Rays generated

---

## V2 — Users & Persistence (Retention)

**Goal:** Let users save their work and come back

| Feature | Priority |
|---------|----------|
| User authentication (email/OAuth) | High |
| User profiles | High |
| Save portfolios to account | High |
| Portfolio history/versions | Medium |
| Private/Public visibility toggle | High |
| Named portfolios | Medium |
| Analytics dashboard | Medium |

**Success Metrics:** Registered users, Saved portfolios, Return visits

---

## V3 — Community (Growth)

**Goal:** Build network effects through social features

| Feature | Priority |
|---------|----------|
| Explore public portfolios | High |
| Search/filter portfolios | High |
| Add to favorites | Medium |
| Comments on portfolios | Medium |
| User following | Low |
| Trending/Popular section | Medium |
| Portfolio comparisons | Low |

**Success Metrics:** DAU, Social interactions, Viral coefficient

---

## Feature Dependencies

```
V1 Features                 V2 Features                 V3 Features
───────────                 ───────────                 ───────────
                            
Portfolio Builder ──────────────────────────────────────────────────►
                            
Asset Resolution ───────────────────────────────────────────────────►
                            
URL Generation ─────────────────────────────────────────────────────►
                            
                            Authentication ─────────────────────────►
                            
                            Save Portfolios ────────────────────────►
                            
                            Public/Private ─────────────────────────►
                            
                                                        Explore ────►
                                                        
                                                        Favorites ──►
                                                        
                                                        Comments ───►
```

