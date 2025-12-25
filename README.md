# 📊 Portfolio X-Ray Generator

## Table of Contents

1. [Project Overview](#project-overview)
2. [Product Description](#product-description)
3. [Architecture](#architecture)
4. [Data Model](#data-model)
5. [API](#api)
6. [User Stories](#user-stories)
7. [Work Tickets](#work-tickets)
8. [Pull Requests](#pull-requests)

---

## Project Overview

| Field | Value |
|-------|-------|
| **Name** | Portfolio X-Ray Generator |
| **Version** | 1.0.0 (MVP) |
| **Status** | In Development |
| **Type** | Web Application |
| **License** | MIT |

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router) |
| Styling | Tailwind CSS |
| State | TanStack Query |
| Backend | NestJS |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | NextAuth.js (V2) |

### Repository Structure

```
portfolio-xray/
├── apps/
│   ├── web/          # Next.js Frontend
│   └── api/          # NestJS Backend
├── packages/
│   └── shared/       # Shared types
├── docs/             # Documentation
└── prompts/          # Development prompts
```

---

## Product Description

### 🎯 Problem

Generating Morningstar X-Ray reports for portfolio analysis currently requires:
- Manual lookup of ISIN → Morningstar ID codes (2-5 min per asset)
- Complex Excel formulas that frequently break
- Tedious and error-prone process

### 💡 Solution

A web application that allows retail investors to generate Morningstar X-Ray reports automatically:

1. **Enter ISINs** → System automatically resolves Morningstar codes
2. **Define weights** → Percentages or absolute amounts
3. **Generate URL** → Direct link to Morningstar PDF
4. **Share** → URL with parameters to recreate the portfolio

### 📈 Success Metric

> **Number of X-Rays generated**

### 🎯 Target User

Individual retail investors managing their own portfolios.

---

## Architecture

### System Diagram

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
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ HTTPS/REST
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND API (NestJS)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Asset     │  │   X-Ray     │  │    Auth     │  │   Social    │        │
│  │  Service    │  │  Service    │  │  Service    │  │  Service    │        │
│  │    (V1)     │  │    (V1)     │  │    (V2)     │  │    (V3)     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────┬───────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE (PostgreSQL)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Assets    │  │    Users    │  │   XRays     │  │   Social    │        │
│  │   (V1)      │  │    (V2)     │  │    (V2)     │  │    (V3)     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Architecture Pattern

```
Controller → Service → Repository → PrismaService → Database
                │
                └──► External APIs (Morningstar resolver)
```

### Asset Resolution Flow

```
User Input (ISIN)
       │
       ▼
┌─────────────────┐
│ Normalize Input │
└────────┬────────┘
         ▼
┌─────────────────┐     ┌──────────────┐
│ Search Cache DB │────►│ Return Asset │ (if exists)
└────────┬────────┘     └──────────────┘
         │ (not found)
         ▼
┌─────────────────┐
│ Web Search      │
│ Morningstar     │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Validate &      │
│ Calculate Score │
└────────┬────────┘
         ▼
    ┌────┴────┐
    │         │
 High Conf  Failed
    │         │
    ▼         ▼
 Accept    Manual Input
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│ Save to Cache   │
└─────────────────┘

---

## Quick Start

```bash
# Clone repository
git clone https://github.com/your-user/portfolio-xray.git
cd portfolio-xray

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Run migrations
npx prisma migrate dev

# Start development
npm run dev
```

---

## License

MIT License - See `LICENSE` for details.
