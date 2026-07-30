# DECISIONS.md — Architecture & Design Decisions

> Real-Estate Listing Platform. This document captures every architectural
> decision made in **Session 0 (Planning & Architecture)** with a one-line
> justification each. It is the single source of truth for *why* the system is
> built the way it is, and doubles as interview/review prep. Update it as later
> sessions refine decisions.

**Stack:** Next.js (App Router, TypeScript) · Node.js + Express + TypeScript · PostgreSQL · Swagger/OpenAPI

---

## 1. High-Level Architecture

### 1.1 System diagram (client → API → DB, auth, images)

```
                         ┌─────────────────────────────────────────────┐
                         │                  BROWSER                     │
                         │  Next.js App Router (SSR / ISR / Client)     │
                         │  - Server Components: listing grid, detail   │
                         │  - Client islands: filters, forms, auth ctx  │
                         │  - Access token held in memory (JS variable) │
                         └───────────────┬─────────────────────────────┘
                                         │  HTTPS (JSON)
                     access token (Bearer, 15 min) in Authorization header
                     refresh token (7 days) in httpOnly, Secure cookie
                                         │
                         ┌───────────────▼─────────────────────────────┐
                         │         EXPRESS + TYPESCRIPT API             │
                         │  Route → Middleware → Controller → Service   │
                         │           → Model → DB → JSON                │
                         │  Middleware: auth, validation (Zod),         │
                         │              rate-limit, ownership, errors    │
                         │  Swagger UI mounted at /api-docs             │
                         └──────┬───────────────────────────┬──────────┘
                                │                            │
              ┌─────────────────▼──────────┐   ┌─────────────▼───────────────┐
              │       PostgreSQL           │   │   Cloud Object Storage      │
              │  users, properties,        │   │   (S3 / Cloudinary)         │
              │  property_images,          │   │   - stores binary images    │
              │  inquiries, refresh_tokens │   │   - API stores only URLs    │
              │  Indexed for search @ 50k+ │   │     in property_images      │
              └────────────────────────────┘   └─────────────────────────────┘
```

### 1.2 Auth flow (sequence)

```
Register:  client → POST /auth/register → bcrypt hash → store user
Login:     client → POST /auth/login
             → verify password
             → issue access JWT (15m)  ──────────► returned in JSON body (kept in memory)
             → issue refresh token (7d) ─────────► set as httpOnly Secure cookie
                                                    (hashed copy stored in refresh_tokens)
Protected: client → GET /... (Authorization: Bearer <access>) → authMiddleware verifies → req.user
Refresh:   client → POST /auth/refresh (cookie sent automatically)
             → look up hashed token → validate → ROTATE (invalidate old, issue new pair)
Logout:    client → POST /auth/logout → delete/invalidate stored refresh token + clear cookie
```

### 1.3 Image upload flow

```
Client (multipart/form-data) → POST /api/properties (or image endpoint)
  → multer parses file(s) in memory/temp
  → upload buffer to cloud object storage (S3/Cloudinary)
  → receive public URL
  → INSERT URL into property_images (DB stores URL only, never the binary)
```

---

## 2. Decisions

### D-1 — Language: TypeScript everywhere
**Decision:** TypeScript on both frontend and backend.
**Why:** Assignment emphasizes "production-level practices"; TS catches schema/DTO/response-shape mismatches at compile time and is the default expectation at this level.

### D-2 — Backend architecture: MVC + Service layer
**Decision:** `Route → Middleware → Controller → Service → Model → DB`.
**Why:** Controllers stay thin (req/res only); business logic (token rotation, duplicate-inquiry checks) lives in reusable, testable services. The "View" is the Next.js app — the API is JSON-only.

### D-3 — Token strategy
**Decision:** Short-lived access token (JWT, **15 min**) + long-lived refresh token (**7 days**). Refresh token stored in an **httpOnly, Secure, SameSite cookie**, stored **hashed** in `refresh_tokens`, and **rotated on every use** (old invalidated).
**Why:** Short access-token lifetime limits blast radius of a leaked token; httpOnly cookie keeps the refresh token out of reach of XSS/JS; rotation detects/limits refresh-token theft. Access token kept in memory (not localStorage) to avoid XSS exfiltration.

### D-4 — Image handling
**Decision:** **Cloud object storage (S3 or Cloudinary)**; DB stores **only the URL**. No Firebase/Supabase (per constraints).
**Why:** Keeps Postgres small and fast, offloads bandwidth/CDN to purpose-built storage, and horizontally scales independent of the app server. Storing binaries in the DB would bloat backups and slow queries.

### D-5 — Pagination at scale
**Decision:** **Cursor-based (keyset) pagination**, not OFFSET/LIMIT. Response returns a `nextCursor`.
**Why:** OFFSET N must scan and discard N rows — cost grows linearly and degrades badly past tens of thousands of rows. Keyset pagination (`WHERE (sort_key, id) < (cursor)`) uses the index directly, giving stable O(log n) seeks and correct results even as rows are inserted/deleted mid-scroll.

### D-6 — "Similar properties" algorithm (v1)
**Decision:** Same **city** + same **property_type** + **price within ±20% band**, exclude the current property, `ORDER BY` a relevance score, `LIMIT 6`.
**Why:** Cheap, index-friendly (uses the composite `city, property_type, price` index), and produces intuitively relevant matches without ML infrastructure.
**Future upgrade:** vector-embedding similarity (semantic match on description/features) once a baseline exists.

### D-7 — SEO strategy
**Decision:** **ISR** (`revalidate: 3600`) for property detail pages + dynamic `generateMetadata()` per listing (title, description, Open Graph, Twitter cards). Listing grid as Server Component.
**Why:** ISR serves static-fast, SEO-friendly HTML while refreshing hourly without a full rebuild — ideal for large, slowly-changing catalogs. `generateMetadata()` gives each listing unique, crawlable metadata.

### D-8 — ORM / DB access
**Decision:** Pick **one** ORM and stay consistent — **Prisma** recommended (auto-generates TS types, pairs with Prisma Migrate).
**Why:** Prisma's generated types reinforce D-1 (type safety across models/controllers), and migrations are first-class. If raw `pg`/Knex is chosen instead, hand-write DTOs in `/types`.
**Status:** ✅ **Locked in Session 1 — Prisma.** `@prisma/client` + `prisma` installed; `prisma/schema.prisma` holds the datasource/generator (models designed in Session 2). Hand-written DTOs live in `backend/src/types` as the API-facing shapes.

### D-9 — Indexing plan (set up front)
**Decision:** Index `properties(city)`, `properties(property_type)`, `properties(price)`, composite `properties(city, property_type, price)`, and `properties(created_at)`.
**Why:** Search/filter (Session 5) and similar-properties (Session 6) hit exactly these columns; the composite index serves the common filtered-search path, and `created_at` serves "newest first" sorting + keyset cursors. Verified later with `EXPLAIN ANALYZE` against 50k+ seeded rows.

### D-10 — Validation
**Decision:** **Zod** for input validation via middleware.
**Why:** Zod schemas infer TS types (single source of truth for shape + runtime check), aligning with D-1; one schema validates the request and types the handler.

### D-11 — Anti-spam / duplicate inquiries
**Decision:** Unique constraint on `(property_id, inquirer_email, DATE(created_at))` (block same-day resubmission) + `express-rate-limit` per IP and per user + honeypot field / basic content filtering.
**Why:** Layered defense: DB constraint stops exact duplicates authoritatively, rate-limit stops rapid-fire floods, honeypot stops naive bots — each covers the others' gaps.

### D-12 — Next.js Server vs Client components
**Decision:** Default to **Server Components**; mark `"use client"` only for interactive islands (filters, forms, image upload, auth provider).
**Why:** Maximizes SEO + minimizes shipped JS; small client islands preserve interactivity without turning whole pages client-side.

### D-13 — API security baseline
**Decision:** `helmet.js`, explicit CORS config, input sanitization, rate limits on public/auth endpoints, consistent JSON error shape via error-handling middleware.
**Why:** Standard production hardening; a uniform error contract makes the API predictable for the frontend and for Swagger consumers.

### D-14 — Deployment target
**Decision:** Frontend on **Vercel**, backend + Postgres on **Railway/Render**; provide **Docker Compose** for local reviewer setup.
**Why:** Vercel is the native Next.js host (ISR support out of the box); Railway/Render give managed Postgres + a Node service with minimal ops. Docker Compose lets a reviewer run everything locally in one command.

---

## 3. Open questions
- ~~Final ORM lock-in~~ → resolved in Session 1: **Prisma** (D-8).
- ~~Monorepo vs two-folder~~ → resolved in Session 1: **two folders** (`/backend` + `/frontend`), simplest.
- ~~Cloud storage provider~~ → resolved: **Cloudinary** (bundles CDN + transforms, simplest upload flow). Uploads namespaced under a `real-estate/` folder; DB stores only the returned secure URL (D-4).
- Database host: resolved — **Neon** (cloud Postgres). App + migrations both use the **direct** (non-pooled) endpoint. Session 5 benchmarking found Neon's free-tier PgBouncer pooler added ~1.2s/query vs ~0.3s direct; PgBouncer only benefits serverless/many-instance deploys, so a single persistent server uses direct. See `docs/PERFORMANCE.md`. (`directUrl` is still set for Prisma Migrate, which must never use a pooler.)

---

## 4. Definition of Done (Session 0)
✅ Every decision above is captured with a one-line justification.
✅ Architecture, auth, and image-flow diagrams are drawn.
✅ Each choice can be explained out loud without notes (that's the interview bar).
