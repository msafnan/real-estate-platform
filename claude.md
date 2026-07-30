# Real-Estate Listing Platform — Session-Based Implementation Plan

**Stack:** Next.js (App Router) + Tailwind CSS · Node.js + Express.js + **TypeScript** · PostgreSQL · Swagger/OpenAPI
**Total estimated effort:** ~40–60 hrs (with AI-assisted development)
**Format:** 12 sessions, ~3–5 hrs each. Do them in order — later sessions depend on earlier ones.

> **Language note:** The assignment PDF doesn't explicitly mandate TypeScript, but given the emphasis on "production-level development practices," this plan uses **TypeScript throughout** (both frontend and backend). It catches schema/type mismatches early (e.g. property fields, API response shapes) and is close to a default expectation at this level. If you'd rather use plain JavaScript for speed, just drop the `.ts`/`.tsx` extensions and skip the type-related steps below — the folder structure and logic stay identical.

Check off tasks as you go. Each session ends with a "Definition of Done" so you know when to stop and move on.

---

## Session 0 — Planning & Architecture (2–3 hrs)

**Goal:** Decide on all architecture questions *before* writing code, so you don't redo work later.

- [ ] Sketch high-level architecture diagram (client → API → DB, auth flow, image storage flow)
- [ ] Decide token strategy: short-lived access token (15 min) + long-lived refresh token (7 days), refresh token stored in httpOnly cookie, rotated on use
- [ ] Decide image handling: local disk vs. cloud (S3/Cloudinary) — pick cloud object storage + store only URLs in DB (no Firebase/Supabase per constraints)
- [ ] Decide pagination strategy for 50k+ records: **cursor-based (keyset) pagination**, not OFFSET/LIMIT
- [ ] Decide similarity algorithm for "similar properties": same city + property type + price within ±20% band, ORDER BY relevance score, LIMIT 6 (documented as v1; mention vector-embedding approach as a future upgrade)
- [ ] Decide SEO strategy: ISR (`revalidate: 3600`) for property detail pages, dynamic `generateMetadata()` per listing
- [ ] Write a `DECISIONS.md` capturing every choice above with a one-line justification — you'll need this for the interview/review

**Definition of Done:** You can explain, out loud, every architectural decision without notes.

---

## Session 1 — Project Scaffolding (2–4 hrs)

- [ ] Init monorepo or two-folder structure: `/backend`, `/frontend`
- [ ] Backend: Express + TypeScript app, folder structure:
  ```
  /src
    /config       (db, env)
    /routes
    /controllers
    /services
    /models
    /middleware
    /validators
    /types        (shared interfaces/DTOs)
    /utils
  ```
- [ ] Backend: `tsconfig.json`, `ts-node-dev` (or `tsx`) for dev server, build step (`tsc`) for production
- [ ] Define shared TypeScript interfaces/types early: `User`, `Property`, `PropertyImage`, `Inquiry`, `AuthTokens` — put in `/types`, reuse across models/controllers/services
- [ ] If using an ORM: Prisma generates types automatically (recommended pairing with TS); if using raw `pg`/Knex, hand-write DTOs

### Architecture note: MVC + Service Layer
This is an **MVC** backend with one standard addition:

| MVC Concept | Folder | Role |
|---|---|---|
| Model | `/models` | DB schema/ORM definitions |
| View | *(Next.js frontend)* | API is JSON-only; the "view" lives entirely in the Next.js app |
| Controller | `/controllers` | Handles req/res, calls services, returns response |
| *(extra)* Service | `/services` | Business logic (e.g. duplicate-inquiry check, token rotation) — keeps controllers thin and logic reusable/testable |

Request flow: `Route → Middleware (auth/validation) → Controller → Service → Model → DB → Response (JSON)`
- [ ] Setup PostgreSQL connection (pg / Prisma / Sequelize — pick one ORM and stay consistent)
- [ ] Setup `.env` + `.env.example`
- [ ] Setup ESLint + Prettier
- [ ] Frontend: `create-next-app` with **TypeScript** + App Router + Tailwind (`npx create-next-app@latest --typescript`)
- [ ] Setup Swagger scaffold (`swagger-jsdoc` + `swagger-ui-express`) mounted at `/api-docs`
- [ ] Setup basic health-check route (`GET /health`) and confirm docs render

**Definition of Done:** `npm run dev` on both frontend and backend works; `/api-docs` loads an empty Swagger page.

---

## Session 2 — Database Schema Design (3–4 hrs)

- [ ] Design tables: `users`, `properties`, `property_images`, `inquiries`, `refresh_tokens`
- [ ] Define relationships (1 user → many properties, 1 property → many images, 1 property → many inquiries)
- [ ] Add indexes up front:
  - `properties(city)`
  - `properties(property_type)`
  - `properties(price)`
  - Composite index: `properties(city, property_type, price)`
  - `properties(created_at)` for sorting
- [ ] Write migration files (don't hand-edit the DB — use a migration tool: Prisma Migrate / node-pg-migrate / Knex)
- [ ] Seed script: generate 50,000+ fake property rows (use `faker.js`) for realistic performance testing later

**Definition of Done:** Migrations run cleanly on a fresh DB; seed script populates 50k+ rows in a reasonable time.

---

## Session 3 — Authentication Module (4–6 hrs)

- [ ] `POST /api/auth/register` — hash password (bcrypt), validate email/password strength
- [ ] `POST /api/auth/login` — issue access token (JWT, 15 min) + refresh token (httpOnly cookie, 7 days, stored hashed in `refresh_tokens` table)
- [ ] `POST /api/auth/refresh` — validate refresh token, rotate it (invalidate old, issue new)
- [ ] `POST /api/auth/logout` — invalidate refresh token
- [ ] `authMiddleware` — verifies JWT on protected routes, attaches `req.user`
- [ ] Input validation middleware (Zod / Joi / express-validator)
- [ ] Rate-limit login/register endpoints (`express-rate-limit`) to prevent brute force
- [ ] Swagger-document all auth endpoints

**Definition of Done:** You can register, login, hit a protected route, refresh an expired token, and logout — all verified via Postman/Insomnia and documented in Swagger.

---

## Session 4 — Property Listing CRUD (5–8 hrs)

- [ ] `POST /api/properties` — create listing (authenticated), validate schema (title, price, city, type, bedrooms, description, images)
- [ ] `GET /api/properties/:id` — view detail
- [ ] `PUT /api/properties/:id` — edit (ownership check: only owner can edit)
- [ ] `DELETE /api/properties/:id` — delete (ownership check + cascade delete images/inquiries or soft-delete)
- [ ] `GET /api/properties` — list all (paginated — build the cursor logic now, reuse in Session 5)
- [ ] Image upload handling: multipart upload → cloud storage → save URLs to `property_images`
- [ ] Ownership middleware (`isOwner`) reusable across edit/delete
- [ ] Swagger-document all endpoints with example payloads

**Definition of Done:** Full CRUD works end-to-end with real image uploads; a second user cannot edit/delete another user's listing (test this explicitly).

---

## Session 5 — Search, Filtering, Pagination at Scale (5–8 hrs)

- [ ] `GET /api/properties/search?city=&type=&minBudget=&maxBudget=&bedrooms=&sort=&cursor=`
- [ ] Implement cursor-based (keyset) pagination — return `nextCursor` in response, not just `page` numbers
- [ ] Add sorting options: price asc/desc, newest first
- [ ] Run `EXPLAIN ANALYZE` on the search query against your 50k-row seed data
- [ ] Confirm composite index from Session 2 is actually being used (check query plan for index scan, not seq scan)
- [ ] Add response-level optimization: only `SELECT` needed columns, avoid `SELECT *`
- [ ] Load test with a tool like `autocannon` or `k6` — document response times

**Definition of Done:** You have an `EXPLAIN ANALYZE` output showing an index scan, and a response time benchmark (e.g., "p95 response time: 80ms at 50k rows") written down for your submission notes.

---

## Session 6 — Similar Properties (2–4 hrs)

- [ ] `GET /api/properties/:id/similar` — implement the algorithm decided in Session 0
- [ ] Query: same city + type, price within band, exclude the current property, `LIMIT 6`
- [ ] Add a supporting index if the query plan needs one
- [ ] Cache result briefly (in-memory or Redis) since it's read-heavy and doesn't change often
- [ ] Swagger-document the endpoint

**Definition of Done:** Detail page returns relevant, performant similar-property suggestions.

---

## Session 7 — Lead / Inquiry Module (3–5 hrs)

- [ ] `POST /api/properties/:id/inquiries` — submit inquiry (name, phone/email, message)
- [ ] Duplicate prevention: unique constraint on `(property_id, inquirer_email, DATE(created_at))` or similar — block resubmission within a time window
- [ ] Spam protection: rate-limit per IP and per user (`express-rate-limit`), plus honeypot field or basic content filtering
- [ ] Validation: sanitize inputs, reject obviously malformed emails/phones
- [ ] `GET /api/properties/:id/inquiries` — owner-only, view leads on their own listing
- [ ] Swagger-document with notes on your anti-spam approach (write this up clearly — it's explicitly evaluated)

**Definition of Done:** Submitting the same inquiry twice in a row is blocked; rapid-fire submissions from one IP get rate-limited.

---

### Architecture note: Server vs Client Components (Next.js App Router)
The entire UI is Next.js (no separate view layer on the backend). Within App Router, choose per page/component:

| Page / Component | Type | Why |
|---|---|---|
| Listing grid page | **Server Component** | Fetches data server-side for SEO; less JS shipped |
| Property detail page | **Server Component** (SSR/ISR) | Required for SEO — `generateMetadata()`, ISR revalidation |
| Filter/sort controls | **Client Component** (`"use client"`) | Needs interactive state |
| Inquiry form | **Client Component** | Needs form state, submit handling, client-side validation |
| Image upload UI | **Client Component** | File input state, preview, upload progress |
| Login/Register forms | **Client Component** | Form state, client-side validation, calls auth API |
| Auth context/provider | **Client Component** | Holds token in memory, wraps app |
| Navbar/Footer | **Server Component** (unless it shows auth state reactively, then Client) | Mostly static |
| My Listings dashboard | **Server Component** shell + **Client** action buttons (edit/delete) | List is server-fetched; delete/edit buttons need client interactivity |

Rule of thumb: default to Server Component; only mark `"use client"` when you need state, event handlers, or browser-only APIs. Keep client components small ("islands") rather than making whole pages client-side — this preserves the SEO benefit.

---

## Session 8 — Frontend: Auth + Layout (4–6 hrs)

- [ ] Register/login pages, client-side form validation
- [ ] Auth context/store (React context or Zustand) to hold access token in memory, silently refresh via `/auth/refresh`
- [ ] Protected route wrapper for "My Listings" / "Create Listing" pages
- [ ] Global layout: navbar, footer, responsive shell
- [ ] Loading and error states as reusable components

**Definition of Done:** A user can register, log in, get redirected properly, and stay logged in across a page refresh.

---

## Session 9 — Frontend: Listings, Search, Detail Pages (6–10 hrs)

- [ ] Listing grid page with filters (city, budget, type, bedrooms) + sort + infinite scroll or "load more" using cursor pagination
- [ ] Property detail page — SSR/ISR per your Session 0 decision, `generateMetadata()` for SEO (title, description, OG tags per listing)
- [ ] Similar properties section on detail page
- [ ] Create/Edit listing form (with image upload UI, preview, validation)
- [ ] My Listings dashboard (edit/delete own listings)
- [ ] Inquiry form on detail page with success/duplicate/error states

**Definition of Done:** Full user journey works in the browser: search → filter → view detail → see similar properties → submit inquiry → (as owner) create/edit/delete own listing.

---

## Session 10 — SEO Pass (2–4 hrs)

- [ ] Confirm ISR revalidation works (change a listing, confirm it updates within the revalidate window)
- [ ] Add `generateMetadata()` for dynamic title/description per property
- [ ] Add Open Graph + Twitter card tags
- [ ] Add a basic `sitemap.xml` generator for property URLs
- [ ] Add `robots.txt`
- [ ] Run Lighthouse SEO audit, fix flagged issues

**Definition of Done:** Lighthouse SEO score ≥ 90 on a property detail page.

---

## Session 11 — Swagger/OpenAPI Completion (2–3 hrs)

- [ ] Ensure every endpoint (auth, properties, search, similar, inquiries) is documented
- [ ] Add request/response schemas, example payloads, and auth (bearer token) requirements per route
- [ ] Confirm `/api-docs` is fully navigable and testable directly from the Swagger UI

**Definition of Done:** A reviewer can understand and test your entire API from `/api-docs` alone, without reading your code.

---

## Session 12 — Testing, Polish, Deployment Prep (5–8 hrs)

- [ ] Write a handful of key tests (auth flow, ownership checks, duplicate inquiry prevention, pagination correctness) — doesn't need 100% coverage, but cover the "trust me" claims from your write-up
- [ ] Error-handling middleware: consistent JSON error shape across the API
- [ ] Environment-based config check (dev vs. prod)
- [ ] Basic security pass: helmet.js, CORS config, input sanitization, rate limits on public endpoints
- [ ] Write final `README.md`: setup instructions, architecture overview, and a short section per module explaining your key decisions (token strategy, pagination, similarity algorithm, spam prevention) — **this is often what gets read most closely**
- [ ] Deploy (or prepare Docker Compose for local reviewer setup) — Vercel for frontend, Railway/Render for backend + Postgres

**Definition of Done:** A stranger could clone your repo, follow the README, and get the full app running with seeded data in under 15 minutes.

---

## Quick Reference: Time Budget

| Session | Hours |
|---|---|
| 0. Planning & Architecture | 2–3 |
| 1. Scaffolding | 2–4 |
| 2. DB Schema | 3–4 |
| 3. Auth | 4–6 |
| 4. Listings CRUD | 5–8 |
| 5. Search/Pagination @ Scale | 5–8 |
| 6. Similar Properties | 2–4 |
| 7. Lead/Inquiry | 3–5 |
| 8. Frontend Auth/Layout | 4–6 |
| 9. Frontend Listings/Detail | 6–10 |
| 10. SEO | 2–4 |
| 11. Swagger | 2–3 |
| 12. Testing/Polish/Deploy | 5–8 |
| **Total** | **~45–70 hrs** |

## Notes on Using AI Assistance Responsibly
The assignment explicitly disallows unexplained AI-generated boilerplate. To stay on the right side of that:
- Use each session to *understand*, not just paste — rewrite tricky logic in your own words in `DECISIONS.md`.
- Be ready to explain trade-offs (e.g., why cursor pagination beats OFFSET at 50k+ rows) in a review or interview.
- Keep your `DECISIONS.md` updated session by session — it doubles as interview prep.
