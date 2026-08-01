# Task: Add an owner-only "Inquiries (leads)" view on the property detail page

## Context
The backend already supports listing inquiries, but the frontend has no UI to show them.
Owners submit-and-forget: `InquiryForm.tsx` does a `POST`, but nothing does a `GET` to
display the leads. Build that missing view.

**Backend endpoint (already live, do not change):**
- `GET /api/properties/:id/inquiries` — **owner-only** (requires auth; a non-owner gets 403).
- Response shape: `{ "inquiries": Inquiry[] }`
- `Inquiry` type already exists in `frontend/src/lib/types.ts`:
  ```ts
  export interface Inquiry {
    id: string;
    propertyId: string;
    inquirerName: string;
    inquirerEmail: string;
    inquirerPhone?: string | null;
    message: string;
    createdAt: string;
  }
  ```

**Auth pattern (use exactly this):**
- `useAuth()` from `frontend/src/context/AuthContext.tsx` gives `{ user, authFetch }`.
- `authFetch(path, init?)` automatically attaches the in-memory access token and retries once on 401.
  Pass a **path starting with `/api/...`** (it prepends `API_URL` internally).
- Owner check convention (see `OwnerActions.tsx`): `user?.id === ownerId`.

## What to build

### 1. New client component: `frontend/src/components/OwnerInquiries.tsx`

Requirements:
- `'use client'` (needs `useAuth`, state, effects).
- Props: `{ propertyId: string; ownerId: string }`.
- If `!user || user.id !== ownerId` → render `null` (invisible to non-owners, just like `OwnerActions`).
- On mount (and when the user becomes the owner), fetch
  `authFetch(`/api/properties/${propertyId}/inquiries`)`.
- Parse `{ inquiries }` from the JSON.
- States: loading, error, empty ("No inquiries yet."), and a list.
- Render each inquiry as a small card: name, email, phone (if present), message, and a
  formatted date from `createdAt`. Show a count in the heading, e.g. "Inquiries (3)".
- Match the existing Tailwind style (white cards, `rounded-lg border border-gray-200`,
  `text-sm`, spacing like the detail page). Reuse `ErrorMessage` from `./ui` for errors.

Reference implementation (adjust class names to taste, keep conventions):
```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Inquiry } from '../lib/types';
import { ErrorMessage } from './ui';

export function OwnerInquiries({ propertyId, ownerId }: { propertyId: string; ownerId: string }) {
  const { user, authFetch } = useAuth();
  const isOwner = !!user && user.id === ownerId;

  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`/api/properties/${propertyId}/inquiries`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Could not load inquiries.');
      }
      const data = await res.json();
      setInquiries(data.inquiries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load inquiries.');
    } finally {
      setLoading(false);
    }
  }, [authFetch, propertyId]);

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner, load]);

  if (!isOwner) return null;

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold">
        Inquiries{inquiries ? ` (${inquiries.length})` : ''}
      </h2>
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      <ErrorMessage message={error} />
      {inquiries && inquiries.length === 0 && !loading && (
        <p className="text-sm text-gray-500">No inquiries yet.</p>
      )}
      <ul className="space-y-3">
        {inquiries?.map((q) => (
          <li key={q.id} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{q.inquirerName}</span>
              <span className="text-gray-400">
                {new Date(q.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="text-gray-600">
              <a href={`mailto:${q.inquirerEmail}`} className="hover:underline">
                {q.inquirerEmail}
              </a>
              {q.inquirerPhone ? ` · ${q.inquirerPhone}` : ''}
            </div>
            <p className="mt-1 whitespace-pre-line text-gray-700">{q.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### 2. Render it on the detail page: `frontend/src/app/properties/[id]/page.tsx`

- Add the import:
  ```ts
  import { OwnerInquiries } from '../../../components/OwnerInquiries';
  ```
- Place it in the main column, right **after** the `<OwnerActions ... />` line (around line 84),
  so it sits under the listing info and only the owner sees it:
  ```tsx
  <OwnerActions propertyId={property.id} ownerId={property.ownerId} />
  <OwnerInquiries propertyId={property.id} ownerId={property.ownerId} />
  ```
  `property.ownerId` is already available on this page (it's passed to `OwnerActions`).

> Note: the detail page is a Server Component, but `OwnerInquiries` is a client component
> ("island"), so it renders fine here — same as `InquiryForm` and `OwnerActions`.

## Acceptance / how to verify
1. `npm run build` (or the running dev server) compiles with no type errors.
2. Logged **out**, or logged in as a **non-owner**: the Inquiries section is **not shown**.
3. Logged in as the **owner** of the listing: the section shows their leads (name, email,
   phone, message, date), or "No inquiries yet."
4. Submit a new inquiry (log out, use the form), then log back in as the owner and reload —
   the new inquiry appears.

## Do NOT
- Do not change the backend or the `Inquiry` type (both already correct).
- Do not use `localStorage`/raw `fetch` for the token — use `authFetch` (handles refresh/401).
- Do not fetch inquiries server-side in the page (it's owner-specific + needs the in-memory
  token) — keep it in the client component.

## Deploy after (frontend only — no Docker)
```powershell
cd C:\red-sand-task
git add .
git commit -m "feat: owner-only inquiries view on property detail page"
git push
```
Vercel auto-rebuilds the frontend (~1–2 min). No backend/Docker changes needed.
