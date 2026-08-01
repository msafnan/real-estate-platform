# Real-Estate Listing Platform

Monorepo-style two-folder project:

| Folder      | Stack                                          | Dev command |
|-------------|------------------------------------------------|-------------|
| `backend/`  | Node + Express + TypeScript + Prisma/Postgres  | `npm run dev` (→ http://localhost:4000) |
| `frontend/` | Next.js (App Router) + TypeScript + Tailwind   | `npm run dev` (→ http://localhost:3000) |

Architecture rationale lives in [`DECISIONS.md`](./DECISIONS.md). Search/index/load-test
results are in [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md).

## Getting started

**Option A — Docker (no cloud accounts needed):**
```bash
docker compose up --build            # Postgres + backend + frontend
docker compose exec backend npm run seed   # once: load 50k demo rows
# App http://localhost:3000 · API docs http://localhost:4000/api-docs
```

**Option B — run locally (Node 18+, a Postgres URL):**
```bash
# backend/
cp .env.example .env    # set DATABASE_URL (+ DIRECT_URL) and CLOUDINARY_* 
npm install && npm run prisma:migrate && npm run seed && npm run dev
# frontend/ (second terminal)
cp .env.local.example .env.local
npm install && npm run dev
```

Demo logins after seeding: `owner1@example.com` … `owner5@example.com` / `Password123`.

## Properties API (Sessions 4–5)

| Method | Route | Auth | Notes |
|--------|-------|------|-------|
| GET | `/api/properties` | public | cursor-paginated list (newest first) |
| GET | `/api/properties/search` | public | filters (`city,type,minBudget,maxBudget,bedrooms`), `sort` (`newest\|price_asc\|price_desc`), keyset `cursor` |
| GET | `/api/properties/:id` | public | detail with images |
| POST | `/api/properties` | Bearer | create |
| PUT / DELETE | `/api/properties/:id` | Bearer + owner | owner-only |
| GET | `/api/properties/:id/similar` | public | up to 6 similar (same city+type, ±20% price), cached ~60s |
| POST / DELETE | `/api/properties/:id/images[/:imageId]` | Bearer + owner | Cloudinary upload / delete |
| POST | `/api/properties/:id/inquiries` | public | submit a lead (anti-spam, see below) |
| GET | `/api/properties/:id/inquiries` | Bearer + owner | view leads for own listing |

## Leads & anti-spam (Session 7)

Inquiry submission is public, so it's defended in layers (each covers the others' gaps):

1. **Duplicate prevention — authoritative, at the DB.** A composite unique index
   `(property_id, inquirer_email, created_date)` allows at most **one inquiry per
   property, per email, per calendar day**. A repeat returns **409**. This is
   enforced by Postgres, not app logic, so it holds under races.
2. **Rate limiting — per IP (and per user when authenticated).** `express-rate-limit`
   caps submissions at **5 per 15 min**; excess returns **429**. Runs before
   validation so abuse is rejected cheaply.
3. **Honeypot field.** The form includes a hidden `website` field real users never
   fill. If it's non-empty, the request is **silently accepted (200) but not stored** —
   bots get no signal that they were caught.
4. **Content filter.** Messages with **3+ links** are treated as spam (also silent-dropped).
5. **Validation + sanitization.** Zod validates email/phone formats; name and message
   are trimmed and stripped of HTML tags before storage.

Verify: `bash scripts/inquiry-smoke.sh` (covers duplicate 409, honeypot/content silent-drop,
validation 400, owner-only 403/401, and rate-limit 429).

## Frontend (Sessions 8–9)

Next.js App Router. Server Components by default; `"use client"` only for interactive islands.

| Route | Type | Notes |
|-------|------|-------|
| `/properties` | Client island | grid + filters + sort + cursor "load more" |
| `/properties/[id]` | **Server (ISR `revalidate:3600`)** | `generateMetadata()` + OG/Twitter tags, gallery, similar, inquiry form |
| `/properties/new`, `/properties/[id]/edit` | Client (protected) | shared `PropertyForm` + Cloudinary image upload/preview |
| `/dashboard` | Client (protected) | "My listings" via `GET /properties/mine`, edit/delete |
| `/login`, `/register` | Client | client-side validation |

- **Auth:** access token held **in memory** (React context, never localStorage); silent refresh via `POST /auth/refresh` on load so sessions survive page reloads. `authFetch` retries once on 401.
- **SEO:** per-listing title/description/OG/Twitter via `generateMetadata()`; ISR keeps detail pages static-fast and fresh.

- API health check: `GET http://localhost:4000/health`
- API docs (Swagger): `http://localhost:4000/api-docs`

## Testing (Session 12)

- **Unit tests** (`cd backend && npm test`) — Node's built-in runner covers the
  trickiest pure logic: cursor encode/decode + keyset predicate, and the TTL cache.
- **Integration smoke scripts** (`backend/scripts/*.sh`, run against a live API) cover
  the "trust me" claims end-to-end:
  - `auth-smoke.sh` — register → protected route → login → refresh (rotation) → logout
  - `property-smoke.sh` — CRUD + **ownership** (403 for non-owner) + real Cloudinary upload
  - `search-smoke.sh` — filters, all sorts, keyset pagination correctness
  - `inquiry-smoke.sh` — duplicate 409, honeypot/content silent-drop, validation 400, rate-limit 429

## Deployment (Session 12)

- **Local (reviewers):** `docker compose up --build` (see Getting started) — Postgres +
  backend + frontend, no cloud accounts required.
- **Cloud:** frontend → **Vercel** (native Next.js/ISR); backend → **Render/Railway** with
  managed Postgres. Set `DATABASE_URL`/`DIRECT_URL`, `JWT_*`, `CLOUDINARY_*`, and
  `CORS_ORIGIN`/`NEXT_PUBLIC_API_URL` per environment. `npx prisma migrate deploy` applies
  migrations; `npm run seed` optionally loads demo data.

## Security & config

`helmet`, explicit CORS allow-list (credentialed), Zod validation + input sanitization on
every write, rate limiting on auth + inquiry endpoints, a consistent JSON error envelope,
and env-based config (`NODE_ENV`, secrets never committed — `.env` is gitignored, only
`.env.example` is tracked).

## Auth (Session 3)

Endpoints (all under `/api/auth`, documented in Swagger):

| Method | Route        | Auth        | Purpose |
|--------|--------------|-------------|---------|
| POST   | `/register`  | public      | Create account → access token + refresh cookie |
| POST   | `/login`     | public      | Log in → access token + refresh cookie |
| POST   | `/refresh`   | cookie      | Rotate refresh token → new access token |
| POST   | `/logout`    | cookie      | Revoke refresh token |
| GET    | `/me`        | Bearer JWT  | Current user from access token |

- **Access token:** JWT, 15 min, sent in `Authorization: Bearer <token>` (kept in memory client-side).
- **Refresh token:** opaque 256-bit value in an httpOnly cookie, 7 days, stored **hashed** (SHA-256) in `refresh_tokens`, **rotated on every refresh**.
- Passwords hashed with bcrypt (12 rounds). Auth endpoints are rate-limited (10 / 15 min / IP).

Verify the full flow (needs a reachable Postgres):

```bash
npm run prisma:migrate     # apply init_auth migration
npm run dev                # terminal 2
bash scripts/auth-smoke.sh # terminal 3 — register→me→login→refresh→logout→reuse-blocked
```

> A full setup/architecture README is finalized in Session 12. This root file is a
> scaffolding orientation only.
