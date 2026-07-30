# End-to-End Runbook — verify everything works

A step-by-step check of the whole app. Tick each ✅ as you go. Two parts:
**A) automated checks** (fast, run in a terminal) and **B) manual browser walkthrough**.

> Right now both servers are already running (backend `:4000`, frontend `:3000`).
> If they are, skip to **Step 2**. Section **0** is how to start from scratch.

---

## 0. Prerequisites (one time)
- Node 18+, a Postgres URL in `backend/.env` (`DATABASE_URL` + `DIRECT_URL`), Cloudinary vars set.
- Dependencies installed: `cd backend && npm install`, `cd frontend && npm install`.
- DB migrated + seeded:
  ```bash
  cd backend
  npm run prisma:migrate      # (or: npx prisma migrate deploy)
  npm run seed                # ~50k demo rows; owners owner1..5@example.com / Password123
  ```

## 1. Start the servers

**Backend** (terminal 1):
```bash
cd backend
npm run dev                   # → http://localhost:4000
```
Expect: `API listening on http://localhost:4000`.

**Frontend** (terminal 2) — use the production build for a stable check
(the Next dev server can crash on Windows under memory pressure):
```bash
cd frontend
npm run build
npm run start                 # → http://localhost:3000
```
Expect: `✓ Ready` / `Local: http://localhost:3000`.

---

## 2. Automated checks (terminal)

### 2a. Backend unit tests
```bash
cd backend && npm test
```
✅ Expect: `# pass 9  # fail 0` (cursor pagination + TTL cache logic).

### 2b. Backend health + Swagger
```bash
curl http://localhost:4000/health          # → {"status":"ok",...}
```
✅ Open http://localhost:4000/api-docs — Swagger UI lists auth, properties, search,
similar, images, inquiries, health.

### 2c. Integration smoke scripts (each prints statuses to check)
Run from `backend/` with the servers up. (Git Bash: `bash scripts/<name>.sh`.)
```bash
bash scripts/auth-smoke.sh        # register→me→login→refresh→logout→reuse-blocked
bash scripts/property-smoke.sh    # CRUD + ownership 403 + Cloudinary upload + delete
bash scripts/search-smoke.sh      # filters, all sorts, keyset pagination
bash scripts/inquiry-smoke.sh     # duplicate 409, honeypot/spam silent, 400, rate-limit 429
```
✅ Expect (key lines):
- auth: `201 … user … 204 … 401` (reuse blocked after logout)
- property: `create 201`, `owner2 update → 403`, `owner2 delete → 403`, `Cloudinary URL present ✔`, `delete 204`, `get deleted 404`
- search: prices ascending then continuing across pages; `bedrooms >= 5`; bad budget `400`
- inquiry: `201` → `409` → `{received:true}` (spam) → `400` → `403`/`401` → burst `429`

---

## 3. Manual browser walkthrough — http://localhost:3000

### 3a. Browse + search (no login)
1. Open `/properties`. ✅ A grid of listings appears.
2. Set **City = Austin**, **Type = House**, **Max $ = 600000**, **Sort = Price: low→high** → **Apply**.
   ✅ Results are Austin houses, cheapest first.
3. Click **Load more**. ✅ More cards append (no duplicates/jumps).
4. Click **Reset**. ✅ Filters clear, full list returns.

### 3b. Property detail + SEO
5. Click any card. ✅ Detail page: image gallery, price, beds/baths, description.
6. Scroll down. ✅ **Similar properties** row (same city/type, close price).
7. View page source (Ctrl-U). ✅ `<title>` is the listing name; `og:title`/`og:description`/`og:image` present.

### 3c. Inquiry + anti-spam
8. In the **Contact the owner** form: fill Name/Email/Message → **Send inquiry**.
   ✅ "Inquiry sent!"
9. Submit the **same** again. ✅ "You've already sent an inquiry for this property today."

### 3d. Auth
10. Click **Sign up**, create an account (password needs a letter + number, 8+ chars).
    ✅ Redirected to **My Listings** (empty), navbar shows your email + Log out.
11. **Log out**, then **Log in** as `owner1@example.com` / `Password123`.
    ✅ Logged in; **My Listings** shows owner1's listings.
12. **Refresh the page** (F5). ✅ You stay logged in (silent refresh).

### 3e. Create / edit / delete (owner)
13. **+ New Listing** → fill all fields → **attach 1–2 images** → **Create listing**.
    ✅ Redirected to the new detail page; your uploaded images show (from Cloudinary).
14. On that page, **Edit listing** → change the price → **Save changes**.
    ✅ Detail page shows the new price.
15. Go to **My Listings** → **Delete** the listing → confirm.
    ✅ It disappears from the list; visiting its old URL → not found.

### 3f. Ownership protection
16. Copy another owner's listing URL (from `/properties`). As owner1, there's **no Edit
    button** on listings you don't own. ✅ (Enforced server-side too — see 2c property smoke.)

---

## 4. SEO endpoints
```bash
curl http://localhost:3000/robots.txt      # allows /, disallows /dashboard etc., points to sitemap
curl http://localhost:3000/sitemap.xml | grep -c "<url>"   # ✅ 500+ URLs (static + listings)
```

---

## 5. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Detail page 500 in `next dev` | Next dev worker crash (Windows). Use `npm run build && npm run start`. |
| First request very slow after idle (deployed) | Render/Neon free tier waking from sleep (~30–60s). Normal. |
| Login "works" but logs out on refresh (deployed) | Cross-site cookie blocked — use the same-origin proxy (already configured). |
| Seeded card images missing | `picsum.photos` placeholders need internet. Your uploads use Cloudinary. |
| `npm test` can't find tests | Run from `backend/`; paths are `tests/*.test.ts`. |
| Port already in use | Kill the process on 3000/4000 (`netstat -ano | findstr :3000` → `taskkill /PID <pid> /F`). |

---

## 6. Green light for deploy
When Sections 2 and 3 pass, you're ready. Follow **`docs/DEPLOYMENT.md`**
(Vercel + Render + Neon + Cloudinary, same-origin proxy).
