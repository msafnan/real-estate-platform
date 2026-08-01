# How to Deploy Backend Changes (Docker → Render)

Beginner-friendly checklist for shipping backend code changes to production.
The backend runs as a **prebuilt Docker image** on Render — so you build the image
on your laptop, push it to Docker Hub, and tell Render to pull it.

> **Mental model — like shipping a package:**
> 1. **Build** = pack the box on your desk
> 2. **Push** = mail it to the warehouse (Docker Hub)
> 3. **Render deploy** = the store picks it up and puts it on the shelf

**Live backend:** https://real-estate-backend-latest-3oi6.onrender.com
**Docker image:** `710030/real-estate-backend:latest`

---

## Before you start (every time)
- [ ] **Open Docker Desktop** — the whale icon 🐳 in the taskbar must be steady (not animating). Docker has to be running.
- [ ] **Open PowerShell** (search "PowerShell" in the Start menu).

---

## Step 1 — Rebuild the image
**What it does:** bakes your latest backend code into a fresh image on your laptop (~3–4 min).

```powershell
docker build --platform linux/amd64 -f C:\red-sand-task\backend\Dockerfile.compose -t 710030/real-estate-backend:latest C:\red-sand-task\backend
```

✅ **Success looks like** (last lines):
```
naming to docker.io/710030/real-estate-backend:latest
DONE
```
No red `ERROR` = good.

---

## Step 2 — Push the image to Docker Hub
**What it does:** uploads the image to the cloud so Render can grab it (~1–2 min).

```powershell
docker push 710030/real-estate-backend:latest
```

✅ **Success looks like** (last line):
```
latest: digest: sha256:....  size: ....
```

> If it says `denied` / `unauthorized`, run `docker login` first, then push again.

---

## Step 3 — Tell Render to use the new image
Docker Hub now has the new image, but Render is still running the old one until you tell it to pull.

1. Go to **https://dashboard.render.com**
2. Open the service **`real-estate-backend-latest-3oi6`**
3. Top-right → **Manual Deploy** → **Deploy latest reference**
4. Watch the **Logs** tab. In ~40s you'll see:
   ```
   No pending migrations to apply.
   API listening on http://localhost:10000
   ==> Your service is live 🎉
   ```

✅ Done — your change is live.

---

## Verify it's healthy
Open in a browser (or curl):
- https://real-estate-backend-latest-3oi6.onrender.com/health → `{"status":"ok",...}`
- https://real-estate-backend-latest-3oi6.onrender.com/api-docs → Swagger UI

---

## Important reminders
- ⚠️ **`git push` does NOT update the backend.** Only the 3 Docker steps above do.
  (Git push only redeploys the **frontend** on Vercel.)
- If you **only changed the frontend**, skip Docker entirely — just `git push` and Vercel rebuilds.
- **Changed `prisma/schema.prisma`?** First create the migration locally *before* Step 1:
  ```powershell
  cd C:\red-sand-task\backend
  npx prisma migrate dev --name <describe-change>
  ```
  This writes a new file into `prisma/migrations/`. The image runs `prisma migrate deploy`
  automatically on boot, so it applies itself once deployed.

---

## Frontend deploys (for contrast)
The frontend is on **Vercel** and auto-deploys from GitHub:
```powershell
cd C:\red-sand-task
git add .
git commit -m "your message"
git push
```
Vercel rebuilds automatically (~1–2 min). No Docker involved.

---

## Env var changes (no rebuild needed)
- **Backend env var** (e.g. rotate a secret): change it in Render → Render auto-redeploys. No Docker rebuild.
- **Frontend env var** (e.g. `BACKEND_URL`): change it in Vercel → **redeploy** the frontend (env vars are read at build time).

---

## 🔴 Security TODO (do once)
Rotate the secrets that were exposed in chat, then update them in Render:
- **Neon** password → update `DATABASE_URL` + `DIRECT_URL`
- **Cloudinary** API secret → update `CLOUDINARY_API_SECRET`
