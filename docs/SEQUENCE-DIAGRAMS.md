# Portfolio X-Ray Generator — Sequence Diagrams

## V1: Generate X-Ray Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend<br/>(Next.js)
    participant API as Backend API<br/>(NestJS)
    participant AssetService as Asset Service
    participant AssetRepo as Asset Repository
    participant DB as Database<br/>(PostgreSQL)
    participant Resolver as Morningstar<br/>Resolver
    participant Morningstar as Morningstar<br/>(External)

    User->>Frontend: Enter ISIN + weight
    Frontend->>API: POST /assets/resolve
    API->>AssetService: resolveAsset(isin)
    AssetService->>AssetRepo: findByIsin(isin)
    AssetRepo->>DB: SELECT * FROM assets WHERE isin = ?
    
    alt Asset found in cache
        DB-->>AssetRepo: Asset data
        AssetRepo-->>AssetService: Asset
        AssetService-->>API: { asset, source: 'cache' }
    else Asset not in cache
        DB-->>AssetRepo: null
        AssetRepo-->>AssetService: null
        AssetService->>Resolver: resolve(isin)
        Resolver->>Morningstar: Web search: site:morningstar.com "ISIN"
        Morningstar-->>Resolver: Search results
        Resolver->>Resolver: Extract Morningstar ID from URLs
        Resolver->>Resolver: Validate & calculate confidence
        Resolver-->>AssetService: { morningstarId, name, confidence }
        AssetService->>AssetRepo: create(assetData)
        AssetRepo->>DB: INSERT INTO assets
        DB-->>AssetRepo: Created
        AssetRepo-->>AssetService: Asset
        AssetService-->>API: { asset, source: 'resolved' }
    end
    
    API-->>Frontend: Asset details
    Frontend-->>User: Show asset name + validation

    User->>Frontend: Add more assets...
    User->>Frontend: Click "Generate X-Ray"
    Frontend->>API: POST /xray/generate
    API->>API: Build Morningstar URL with IDs + weights
    API-->>Frontend: { morningstarUrl, shareableUrl }
    Frontend-->>User: Show link + "Open PDF" button
    
    User->>Morningstar: Click "Open PDF"
    Morningstar-->>User: X-Ray PDF
```

---

## V1: Low Confidence Resolution Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend
    participant API as Backend API
    participant AssetService as Asset Service
    participant Resolver as Resolver

    User->>Frontend: Enter ISIN
    Frontend->>API: POST /assets/resolve
    API->>AssetService: resolveAsset(isin)
    AssetService->>Resolver: resolve(isin)
    Resolver-->>AssetService: { alternatives: [...], confidence: 0.5 }
    AssetService-->>API: { alternatives, status: 'low_confidence' }
    API-->>Frontend: Multiple candidates
    Frontend-->>User: Show alternatives to pick

    User->>Frontend: Select correct asset
    Frontend->>API: POST /assets/confirm
    API->>AssetService: confirmAsset(isin, morningstarId)
    AssetService->>AssetService: Save with source: 'manual'
    AssetService-->>API: { asset, status: 'confirmed' }
    API-->>Frontend: Asset confirmed
    Frontend-->>User: Show confirmed asset
```

---

## V2: Save X-Ray Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend
    participant API as Backend API
    participant AuthService as Auth Service
    participant XRayService as XRay Service
    participant XRayRepo as XRay Repository
    participant DB as Database

    User->>Frontend: Click "Save X-Ray"
    Frontend->>API: GET /auth/me
    
    alt Not logged in
        API-->>Frontend: 401 Unauthorized
        Frontend-->>User: Show login modal
        User->>Frontend: Login with Google
        Frontend->>API: POST /auth/google
        API->>AuthService: authenticateGoogle(token)
        AuthService-->>API: { user, accessToken }
        API-->>Frontend: Logged in
    end

    Frontend->>API: POST /xrays
    Note right of Frontend: { title, isPublic, assets: [...] }
    API->>XRayService: createXRay(userId, data)
    XRayService->>XRayService: Generate unique slug
    XRayService->>XRayRepo: save(xray)
    XRayRepo->>DB: INSERT INTO xrays, xray_assets
    DB-->>XRayRepo: Created
    XRayRepo-->>XRayService: XRay
    XRayService-->>API: { xray, slug }
    API-->>Frontend: X-Ray saved
    Frontend-->>User: Show success + shareable link
```

---

## V3: Explore & Favorite Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend
    participant API as Backend API
    participant XRayService as XRay Service
    participant SocialService as Social Service
    participant DB as Database

    User->>Frontend: Visit /explore
    Frontend->>API: GET /explore?page=1
    API->>XRayService: getPublicXRays(filters)
    XRayService->>DB: SELECT * FROM xrays WHERE isPublic = true
    DB-->>XRayService: XRays list
    XRayService-->>API: { xrays, pagination }
    API-->>Frontend: Public X-Rays
    Frontend-->>User: Display X-Ray cards

    User->>Frontend: Click on X-Ray
    Frontend->>API: GET /xrays/:slug
    API->>XRayService: getBySlug(slug)
    XRayService->>DB: SELECT with assets JOIN
    DB-->>XRayService: XRay + assets
    XRayService-->>API: XRay details
    API-->>Frontend: Full X-Ray data
    Frontend-->>User: Show X-Ray details

    User->>Frontend: Click "Add to Favorites"
    Frontend->>API: POST /favorites
    API->>SocialService: addFavorite(userId, xrayId)
    SocialService->>DB: INSERT INTO favorites
    DB-->>SocialService: Created
    SocialService-->>API: Success
    API-->>Frontend: Favorited
    Frontend-->>User: Show filled heart icon
```

---

## Component Interaction Overview

```mermaid
sequenceDiagram
    box Frontend
        participant User
        participant UI as Next.js UI
    end
    
    box Backend
        participant Controller
        participant Service
        participant Repository
    end
    
    box Data
        participant DB as PostgreSQL
        participant Cache as Asset Cache
    end
    
    box External
        participant MS as Morningstar
    end

    User->>UI: Interact
    UI->>Controller: HTTP Request
    Controller->>Service: Business Logic
    Service->>Repository: Data Access
    Repository->>DB: Query
    DB-->>Repository: Result
    
    alt Need external data
        Service->>MS: Resolve/Scrape
        MS-->>Service: Data
        Service->>Repository: Cache result
        Repository->>Cache: Store
    end
    
    Repository-->>Service: Data
    Service-->>Controller: Response
    Controller-->>UI: JSON
    UI-->>User: Display
```

