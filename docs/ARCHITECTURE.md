# Portfolio X-Ray Generator — Architecture

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                       │
│                           (React/Next.js)                                   │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Portfolio  │  │   X-Ray     │  │   User      │  │  Explore    │        │
│  │   Builder   │  │   Viewer    │  │  Profile    │  │    Page     │        │
│  │    (V1)     │  │    (V1)     │  │   (V2)      │  │    (V3)     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                │ HTTPS/REST
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND API                                    │
│                              (NestJS)                                       │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                           API Gateway                                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Asset     │  │   X-Ray     │  │    Auth     │  │  Portfolio  │        │
│  │  Service    │  │  Service    │  │  Service    │  │  Service    │        │
│  │    (V1)     │  │    (V1)     │  │    (V2)     │  │    (V2)     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                                                   │               │
│         │         ┌─────────────┐  ┌─────────────┐         │               │
│         │         │  Social     │  │  Analytics  │         │               │
│         │         │  Service    │  │  Service    │         │               │
│         │         │    (V3)     │  │    (V2)     │         │               │
│         │         └─────────────┘  └─────────────┘         │               │
│         │                                                   │               │
└─────────┼───────────────────────────────────────────────────┼───────────────┘
          │                                                   │
          ▼                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE                                       │
│                            (PostgreSQL)                                     │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Assets    │  │    Users    │  │ Portfolios  │  │   Social    │        │
│  │   (V1)      │  │    (V2)     │  │    (V2)     │  │    (V3)     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Morningstar   │  │  Google Search  │  │   OAuth         │
│   (X-Ray PDF)   │  │   (Resolution)  │  │   Providers     │
│                 │  │                 │  │   (V2)          │
└─────────────────┘  └─────────────────┘  └─────────────────┘
   External APIs
```

---

## Data Model

### V1 Entities (3 Core Entities)

```
┌─────────────────────────────────────┐
│              Asset                  │
├─────────────────────────────────────┤
│ id: UUID                            │
│ isin: string (unique)               │
│ morningstarId: string (unique)      │
│ name: string                        │
│ type: ETF | FUND | STOCK | ETC      │
│ ... (fields defined in impl)        │
│ createdAt: timestamp                │
│ updatedAt: timestamp                │
└─────────────────────────────────────┘
          ▲
          │ N:1
          │
┌─────────────────────────────────────┐
│            XRayAsset                │
├─────────────────────────────────────┤
│ id: UUID                            │
│ xrayId: UUID (FK)                   │
│ assetId: UUID (FK)                  │
│ weight: float                       │
│ order: integer                      │
└─────────────────────────────────────┘
          │
          │ N:1
          ▼
┌─────────────────────────────────────┐
│              XRay                   │
├─────────────────────────────────────┤
│ id: UUID                            │
│ slug: string (unique)               │
│ ownerId: UUID (FK to User)          │
│ externalUrl: string (nullable)      │
│ ... (fields defined in impl)        │
│ createdAt: timestamp                │
│ updatedAt: timestamp                │
└─────────────────────────────────────┘
```

### V2 Entities

```
┌─────────────────────────────────────┐
│              User                   │
├─────────────────────────────────────┤
│ id: UUID                            │────────► XRay.ownerId
│ email: string (unique)              │
│ userName: string (unique)           │
│ name: string                        │
│ avatarUrl: string (nullable)        │
│ provider: email | google            │
│ createdAt: timestamp                │
│ updatedAt: timestamp                │
└─────────────────────────────────────┘
```

### V3 Entities

```
┌─────────────────────────────────────┐         ┌─────────────────────────────────────┐
│            Favorite                 │         │            Comment                  │
├─────────────────────────────────────┤         ├─────────────────────────────────────┤
│ id: UUID                            │         │ id: UUID                            │
│ userId: UUID (FK)                   │         │ userId: UUID (FK)                   │
│ xrayId: UUID (FK)                   │         │ xrayId: UUID (FK)                   │
│ createdAt: timestamp                │         │ content: text                       │
└─────────────────────────────────────┘         │ createdAt: timestamp                │
                                                │ updatedAt: timestamp                │
                                                └─────────────────────────────────────┘

```

---

## API Endpoints

### V1 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/assets/resolve` | Resolve ISIN to Morningstar ID |
| GET | `/assets/:id` | Get cached asset details |
| POST | `/xray/generate` | Generate Morningstar URL |

### V2 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register user |
| POST | `/auth/login` | Login user |
| GET | `/auth/me` | Get current user |
| GET | `/xrays` | List user X-Rays |
| POST | `/xrays` | Save X-Ray |
| GET | `/xrays/:slug` | Get X-Ray by slug |
| PUT | `/xrays/:id` | Update X-Ray |
| DELETE | `/xrays/:id` | Delete X-Ray |

### V3 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/explore` | List public X-Rays |
| POST | `/favorites` | Add to favorites |
| DELETE | `/favorites/:id` | Remove from favorites |
| GET | `/xrays/:id/comments` | List comments |
| POST | `/xrays/:id/comments` | Add comment |

---

## Resolution Engine Flow

```
                    User Input
                        │
                        ▼
            ┌───────────────────────┐
            │   Normalize Input     │
            │   (trim, uppercase)   │
            └───────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │   Classify Type       │
            │   ISIN│MS_ID│TICKER   │
            └───────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │   Search Local DB     │◄──────────────────┐
            └───────────────────────┘                   │
                        │                               │
              ┌─────────┴─────────┐                     │
              │                   │                     │
           Found              Not Found                 │
              │                   │                     │
              ▼                   ▼                     │
        ┌──────────┐    ┌───────────────────┐          │
        │  Return  │    │   Web Search      │          │
        │  Cached  │    │   Morningstar     │          │
        └──────────┘    └───────────────────┘          │
                                  │                     │
                                  ▼                     │
                        ┌───────────────────┐          │
                        │   Extract ID      │          │
                        │   from URLs       │          │
                        └───────────────────┘          │
                                  │                     │
                                  ▼                     │
                        ┌───────────────────┐          │
                        │   Validate &      │          │
                        │   Score           │          │
                        └───────────────────┘          │
                                  │                     │
                    ┌─────────────┼─────────────┐      │
                    │             │             │      │
               High Conf     Low Conf      Failed      │
                    │             │             │      │
                    ▼             ▼             ▼      │
              ┌──────────┐ ┌──────────┐ ┌──────────┐  │
              │  Auto    │ │  Show    │ │  Manual  │  │
              │  Accept  │ │  Options │ │  Input   │  │
              └──────────┘ └──────────┘ └──────────┘  │
                    │             │             │      │
                    └─────────────┴─────────────┘      │
                                  │                     │
                                  ▼                     │
                        ┌───────────────────┐          │
                        │   Save to Cache   │──────────┘
                        └───────────────────┘
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js + React | SSR for SEO, App Router |
| Styling | Tailwind CSS | Utility-first |
| State | React Query | Server state management |
| Backend | NestJS | TypeScript, modular |
| Database | PostgreSQL | Relational, robust |
| ORM | Prisma | Type-safe queries |
| Auth | NextAuth.js or Passport | OAuth + email (V2) |
| Hosting | Vercel + Railway | or similar PaaS |

