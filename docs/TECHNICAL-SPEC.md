# Portfolio X-Ray Generator — Technical Specification

## Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Frontend** | Next.js 14+ (App Router) | SSR, SEO, React ecosystem |
| **Styling** | Tailwind CSS | Rapid development, consistency |
| **State** | TanStack Query | Server state, caching |
| **Backend** | NestJS | TypeScript, modular, scalable |
| **Database** | PostgreSQL | Relational, mature, robust |
| **ORM** | Prisma | Type-safe, migrations |
| **Auth** | NextAuth.js | OAuth + credentials |
| **Validation** | Zod | Runtime validation |
| **Testing** | Jest + Playwright | Unit + E2E |

---

## Project Structure

```
portfolio-xray/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/
│   │   │   ├── (public)/       # Public routes
│   │   │   │   ├── page.tsx    # Home/Builder
│   │   │   │   └── xray/       # X-Ray viewer
│   │   │   ├── (auth)/         # Auth routes (V2)
│   │   │   ├── (dashboard)/    # User area (V2)
│   │   │   └── (explore)/      # Community (V3)
│   │   ├── components/
│   │   └── lib/
│   │
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── assets/         # Asset resolution (V1)
│       │   │   ├── assets.controller.ts
│       │   │   ├── assets.service.ts
│       │   │   ├── assets.repository.ts  # ← Data access
│       │   │   ├── assets.module.ts
│       │   │   └── dto/
│       │   ├── xray/           # URL generation (V1)
│       │   │   ├── xray.controller.ts
│       │   │   ├── xray.service.ts
│       │   │   └── xray.module.ts
│       │   ├── auth/           # Authentication (V2)
│       │   ├── social/         # Community (V3)
│       │   ├── prisma/
│       │   │   ├── prisma.service.ts
│       │   │   └── prisma.module.ts
│       │   └── common/         # Shared utilities
│       └── prisma/
│           └── schema.prisma
│
├── packages/
│   └── shared/                 # Shared types/utils
│
└── docs/                       # Documentation
```

---

## Architecture Pattern

### Flow
```
Controller ──► Service ──► Repository ──► PrismaService ──► Database
                  │
                  └──► External APIs (Morningstar resolver)
```

### Responsibilities

| Layer | File | Responsibility |
|-------|------|----------------|
| Controller | `*.controller.ts` | HTTP handling, validation, response formatting |
| Service | `*.service.ts` | Business logic, orchestration |
| Repository | `*.repository.ts` | Database queries only |
| Prisma | `prisma.service.ts` | Database connection management |

---

## Database Schema

### V1 Entities (Asset Resolution Cache)

```prisma
model Asset {
  id            String   @id @default(uuid())
  isin          String   @unique
  morningstarId String   @unique
  ticker        String?
  name          String
  type          AssetType
  currency      String?
  country       String?
  confidence    Float
  source        AssetSource
  status        AssetStatus
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  xrayAssets XRayAsset[]  // V2 relation
}

enum AssetType {
  ETF
  FUND
  STOCK
  ETC
}

enum AssetSource {
  manual
  web_search
  imported
}

enum AssetStatus {
  resolved
  needs_review
  conflict
}
```

### V2 Entities (Users & Saved X-Rays)

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  userName  String   @unique
  name      String
  avatarUrl String?
  provider  AuthProvider
  password  String?  // null for OAuth
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  xrays     XRay[]
  favorites Favorite[]   // V3
  comments  Comment[]    // V3
}

enum AuthProvider {
  email
  google
}

model XRay {
  id          String   @id @default(uuid())
  slug        String   @unique
  title       String?
  isPublic    Boolean  @default(false)
  ownerId     String
  // source field removed - all X-Rays use Morningstar
  externalUrl String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  owner     User        @relation(fields: [ownerId], references: [id])
  assets    XRayAsset[]
  favorites Favorite[]  // V3
  comments  Comment[]   // V3
}

model XRayAsset {
  id      String @id @default(uuid())
  xrayId  String
  assetId String
  weight  Float
  order   Int

  xray  XRay  @relation(fields: [xrayId], references: [id])
  asset Asset @relation(fields: [assetId], references: [id])

  @@unique([xrayId, assetId])
}

// Note: XRaySource enum removed - all X-Rays use Morningstar for now
```

### V3 Entities (Social Features)

```prisma
model Favorite {
  id        String   @id @default(uuid())
  userId    String
  xrayId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  xray XRay @relation(fields: [xrayId], references: [id])

  @@unique([userId, xrayId])
}

model Comment {
  id        String   @id @default(uuid())
  userId    String
  xrayId    String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])
  xray XRay @relation(fields: [xrayId], references: [id])
}
```

---

## API Contracts

### V1: Asset Resolution

```typescript
// POST /api/assets/resolve
// Request
interface ResolveAssetRequest {
  input: string;  // ISIN, Morningstar ID, or ticker
  assetType?: 'ETF' | 'FUND' | 'STOCK' | 'ETC';  // Optional hint for better resolution
}

// Response
interface ResolveAssetResponse {
  success: boolean;
  asset?: {
    id: string;
    isin: string | null;
    morningstarId: string;
    name: string;
    type: 'ETF' | 'FUND' | 'STOCK';
    confidence: number;
  };
  alternatives?: Asset[];  // If low confidence
  error?: string;
}
```

### V1: X-Ray Generation

```typescript
// POST /api/xray/generate
// Request
interface GenerateXRayRequest {
  assets: {
    morningstarId: string;
    weight: number;  // Percentage 0-100
  }[];
}

// Response
interface GenerateXRayResponse {
  url: string;           // Morningstar X-Ray URL
  shareableUrl: string;  // App URL with query params
}
```

### V2: Portfolio CRUD

```typescript
// POST /api/portfolios
interface CreatePortfolioRequest {
  name: string;
  description?: string;
  isPublic: boolean;
  assets: {
    assetId: string;
    weight: number;
  }[];
}

// GET /api/portfolios/:slug
interface PortfolioResponse {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  slug: string;
  user: { id: string; name: string; };
  assets: {
    asset: Asset;
    weight: number;
  }[];
  createdAt: string;
  updatedAt: string;
  // V3 additions
  favoritesCount?: number;
  commentsCount?: number;
  isFavorited?: boolean;
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Auth (V2)
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# API
API_URL=http://localhost:4000

# External
MORNINGSTAR_BASE_URL=https://lt.morningstar.com
```

---

## Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | Vercel | Auto-deploy from main |
| Backend | Railway / Render | Node.js container |
| Database | Railway / Supabase | Managed PostgreSQL |
| Domain | Custom | via Vercel |

---

## Security Considerations

- [ ] Rate limiting on resolution endpoint
- [ ] Input sanitization for all user inputs
- [ ] CORS configuration
- [ ] Helmet.js for HTTP headers
- [ ] SQL injection prevention (Prisma handles)
- [ ] XSS prevention (React handles)
- [ ] CSRF tokens for mutations
- [ ] Password hashing (bcrypt)
- [ ] JWT with short expiry + refresh tokens

