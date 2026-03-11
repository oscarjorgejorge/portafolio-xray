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

## Database Schema (Current)

The database schema is defined in `apps/api/prisma/schema.prisma` and evolves by version:

- **V1**: Asset resolution cache (`Asset`)
- **V2**: Users, authentication, saved portfolios (`User`, `RefreshToken`, `PasswordReset`, `EmailVerification`, `Portfolio`)
- **V3**: Social features on top of portfolios (`Favorite`, `Comment`)
- **V4**: Internal system counters (`AnonymizedUserSequence`)

### V1 Entity — Asset (Resolution Cache)

```prisma
model Asset {
  id            String      @id @default(uuid())
  isin          String?     // Can be null when pending enrichment
  morningstarId String      @unique @map("morningstar_id")
  ticker        String?
  name          String
  type          AssetType
  url           String      // Morningstar URL from resolution
  source        AssetSource
  isinPending   Boolean     @default(false) @map("isin_pending") // True when ISIN enrichment is in progress
  isinManual    Boolean     @default(false) @map("isin_manual")  // True when ISIN was manually entered by user
  tickerManual  Boolean     @default(false) @map("ticker_manual") // True when ticker was manually entered by user
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  @@index([isin]) // Index for lookups, but not unique (allows null)
  @@index([isin, isinPending]) // Composite index for polling queries
  @@index([morningstarId, type]) // Composite index for type filtering
  @@index([ticker]) // Index for ticker-based lookups
  @@map("assets")
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
```

### V2 Entities — Authentication & Saved Portfolios

```prisma
model User {
  id            String       @id @default(uuid())
  email         String       @unique
  userName      String       @unique @map("user_name")
  name          String
  password      String?      // null for OAuth users
  avatarUrl     String?      @map("avatar_url")
  provider      AuthProvider
  emailVerified Boolean      @default(false) @map("email_verified")
  locale        String       @default("es") // User language preference: 'es' or 'en'
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")
  deletedAt     DateTime?    @map("deleted_at")
  isDeleted     Boolean      @default(false) @map("is_deleted")

  refreshTokens      RefreshToken[]
  passwordResets     PasswordReset[]
  emailVerifications EmailVerification[]
  portfolios         Portfolio[]
  favorites          Favorite[]
  comments           Comment[]

  @@map("users")
}

enum AuthProvider {
  email
  google
}

model RefreshToken {
  id        String    @id @default(uuid())
  token     String    @unique
  userId    String    @map("user_id")
  userAgent String?   @map("user_agent") // Browser/device info
  ipAddress String?   @map("ip_address")
  expiresAt DateTime  @map("expires_at")
  createdAt DateTime  @default(now()) @map("created_at")
  revokedAt DateTime? @map("revoked_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

model PasswordReset {
  id        String    @id @default(uuid())
  token     String    @unique
  userId    String    @map("user_id")
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("password_resets")
}

model EmailVerification {
  id        String    @id @default(uuid())
  token     String    @unique
  userId    String    @map("user_id")
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("email_verifications")
}

model Portfolio {
  id                 String    @id @default(uuid())
  userId             String    @map("user_id")
  name               String
  description        String?
  isPublic           Boolean   @default(true) @map("is_public")
  assets             Json      // Array of { morningstarId: string, weight: number, amount?: number }
  xrayShareableUrl   String?   @map("xray_shareable_url")
  xrayMorningstarUrl String?   @map("xray_morningstar_url")
  xrayGeneratedAt    DateTime? @map("xray_generated_at")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")
  deletedAt          DateTime? @map("deleted_at")
  isDeleted          Boolean   @default(false) @map("is_deleted")

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  favorites Favorite[]
  comments  Comment[]

  @@index([userId])
  @@map("portfolios")
}
```

### V3 Entities — Social Features (on Portfolios)

```prisma
model Favorite {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  portfolioId String   @map("portfolio_id")
  createdAt   DateTime @default(now()) @map("created_at")

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  portfolio Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)

  @@unique([userId, portfolioId])
  @@index([userId])
  @@index([portfolioId])
  @@map("favorites")
}

model Comment {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  portfolioId String   @map("portfolio_id")
  content     String
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  portfolio Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)

  @@index([portfolioId])
  @@index([userId])
  @@map("comments")
}
```

### V4 Entity — System Counters

```prisma
model AnonymizedUserSequence {
  id        Int      @id @default(1)
  nextValue Int      @default(0) @map("next_value")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("anonymized_user_sequence")
}
```

---

## API Contracts

### V1: Asset Resolution

```typescript
// POST /assets/resolve
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
// POST /xray/generate
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
// POST /portfolios
interface CreatePortfolioRequest {
  name: string;
  description?: string;
  isPublic: boolean;
  assets: {
    assetId: string;
    weight: number;
  }[];
}

// GET /portfolios/:slug
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

