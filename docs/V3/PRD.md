# Portfolio X-Ray Generator — PRD V3

## Overview

**Phase:** Community  
**Focus:** Growth  
**Dependency:** V2 complete

---

## Goals

1. Build network effects through social features
2. Create discoverability of portfolios
3. Foster community engagement
4. Enable viral growth through sharing

---

## New Features

### 1. Explore Page
- Browse public portfolios
- Filter by: asset type, size, popularity
- Sort by: recent, trending, most favorited
- Search portfolios by name or assets

### 2. Favorites
- Add portfolios to favorites
- View favorites list in profile
- Favorites count on portfolios

### 3. Comments
- Comment on public portfolios
- Reply to comments (optional)
- Edit/delete own comments
- Moderation basics

### 4. Portfolio Comparison (Optional)
- Compare two portfolios side-by-side
- Overlap analysis
- Allocation differences

---

## User Flows

### Explore
```
1. User visits Explore page
2. Browse/filter/search portfolios
3. Click to view portfolio details
4. Actions: Favorite, Comment, Follow user
```

### Social Interaction
```
1. View public portfolio
2. Add to favorites
3. Leave comment
```

---

## Data Model Changes

```typescript
interface Favorite {
  id: string;
  userId: string;
  portfolioId: string;
  createdAt: Date;
}

interface Comment {
  id: string;
  userId: string;
  portfolioId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

```

---

## API Additions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/explore` | Public portfolios feed |
| GET | `/explore/trending` | Trending portfolios |
| POST | `/favorites` | Add favorite |
| DELETE | `/favorites/:id` | Remove favorite |
| GET | `/portfolios/:id/comments` | List comments |
| POST | `/portfolios/:id/comments` | Add comment |

---

## Success Metrics

- Daily active users (DAU)
- Favorites per portfolio
- Comments per portfolio
- Viral coefficient (invites/shares)

