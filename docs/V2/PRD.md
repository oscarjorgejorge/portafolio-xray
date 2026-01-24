# Portfolio X-Ray Generator — PRD V2

## Overview

**Phase:** Users & Persistence  
**Focus:** Retention  
**Dependency:** V1 complete

---

## Goals

1. Allow users to save portfolios for future access
2. Enable portfolio management (create, edit, delete)
3. Implement privacy controls (public/private)
4. Track user engagement and X-Ray generation

---

## New Features

### 1. Authentication
- Email/password registration
- OAuth provider (Google)
- Session management
- Password reset flow

### 2. User Profiles
- Display name
- Avatar (optional)
- List of user's portfolios
- Account settings

### 3. Portfolio Persistence
- Save portfolio with name
- Optional description
- Public/Private toggle
- Unique shareable slug (`app.com/p/my-portfolio`)
- Edit existing portfolios
- Delete portfolios

### 4. Portfolio Timestamps
- Created date
- Last updated timestamp

### 5. Analytics
- Track X-Rays generated per user
- Track anonymous generations
- Resolution success rate dashboard

---

## User Flows

### Save Portfolio (New)
```
1. User generates X-Ray (V1 flow)
2. Prompt: "Save this portfolio?"
3. If not logged in → prompt login/register
4. Enter name + optional description
5. Choose visibility (public/private)
6. Portfolio saved to account
```

### Manage Portfolios
```
1. User goes to "My Portfolios"
2. See list of saved portfolios
3. Actions: View, Edit, Delete, Regenerate
```

---

## Data Model (V2 Additions)

```typescript
// User = Registered user
interface User {
  id: string;
  email: string;
  userName: string;
  name: string;
  avatarUrl?: string;
  provider: 'email' | 'google';
  createdAt: Date;
  updatedAt: Date;
}

// Note: V1 entities remain (Asset, XRay, XRayAsset)
// XRay.ownerId links to User.id
```

---

## API Additions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register |
| POST | `/auth/login` | No | Login |
| GET | `/auth/me` | Yes | Current user |
| GET | `/portfolios` | Yes | User's portfolios |
| POST | `/portfolios` | Yes | Save portfolio |
| GET | `/portfolios/:slug` | Mixed | Get portfolio |
| PUT | `/portfolios/:id` | Yes | Update |
| DELETE | `/portfolios/:id` | Yes | Delete |

---

## Success Metrics

- Registered users
- Portfolios saved per user
- Return visit rate
- Private vs public ratio

