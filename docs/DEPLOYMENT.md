# Deployment Guide (free tier)

Stack: **Vercel** (frontend) · **Render** (backend) · **Neon** (Postgres) · **Cloudinary** (images).
All have a no-credit-card free tier. Auth uses a **same-origin API proxy** (Next.js
rewrites `/api/*` → backend), so cookies are first-party and there is no CORS.

> ⚠️ Rotate the Neon password and Cloudinary API secret first (they were shared in
> chat). Put the new values in the hosting env vars below, never in git.

---

## 0. Push to GitHub

```bash
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 1. Database — Neon (already set up)
- Reuse the existing project, or create one. Copy the **direct** (non-pooled)
  connection string. Ideally pick the Neon region closest to your Render region.

## 2. Backend — Render
1. **New → Web Service**, connect the repo.
2. **Root Directory:** `backend`
3. **Build Command:**
   `npm ci --include=dev && npx prisma generate && npm run build`
   *(`--include=dev` is required — TypeScript/Prisma are devDependencies.)*
4. **Start Command:** `npx prisma migrate deploy && node dist/index.js`
5. **Environment variables:**
   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Neon direct URL |
   | `DIRECT_URL` | Neon direct URL |
   | `JWT_ACCESS_SECRET` | long random string |
   | `JWT_REFRESH_SECRET` | different long random string |
   | `ACCESS_TOKEN_TTL` | `15m` |
   | `REFRESH_TOKEN_TTL` | `7d` |
   | `STORAGE_PROVIDER` | `cloudinary` |
   | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | rotated values |
   | `CLOUDINARY_FOLDER` | `real-estate` |
   | `CORS_ORIGIN` | your Vercel URL *(optional — proxy makes it moot)* |
   > Don't set `PORT` — Render injects it and the app reads it.
6. Deploy. Note the URL, e.g. `https://estate-api.onrender.com`.
7. **Seed once:** open the Render **Shell** → `npm run seed`.

*Free-tier note:* the service sleeps after ~15 min idle; the first request then
takes ~30–60s to wake (Neon also wakes). Normal for free hosting.

## 3. Frontend — Vercel
1. **New Project → Import** the repo.
2. **Root Directory:** `frontend` (framework auto-detected as Next.js).
3. **Environment variables** (Production + Preview):
   | Key | Value |
   |-----|-------|
   | `BACKEND_URL` | your Render URL (e.g. `https://estate-api.onrender.com`) |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel URL (e.g. `https://estate.vercel.app`) |
4. Deploy. `BACKEND_URL` is read by `next.config` (the `/api/*` proxy) at build
   and by Server Components at runtime.

## 4. Verify
- `https://<vercel>/health` proxies to the API → `{"status":"ok"}`
- `https://<vercel>/api-docs` — Swagger *(served by the backend; open the Render URL directly: `https://<render>/api-docs`)*
- Browse `/properties`, open a listing (SSR + SEO), register/login, create a
  listing with an image, submit an inquiry.
- `https://<vercel>/sitemap.xml` and `/robots.txt` resolve.

## How the pieces talk
```
Browser ──HTTPS──> Vercel (Next.js)
   │  /api/*  ── rewrite ──> Render (Express)  ── SQL ──> Neon
   │                              └── uploads ──> Cloudinary
   └── everything is same-origin from the browser's view → first-party cookies, no CORS
```
