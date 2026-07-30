# Performance Notes — Search & Pagination at Scale (Session 5)

**Dataset:** 50,000 properties + 50,000 images (faker seed).
**DB:** Neon PostgreSQL, region `us-east-2` (Ohio), **free tier**.
**Test machine:** developer laptop in a different continent (~290 ms network RTT to the DB region). This matters — see "Interpreting the numbers".

---

## 1. Query plan — index is used (not a seq scan)

`EXPLAIN ANALYZE` for the core filtered search
(`city + property_type + price range`), 50k rows:

### sort = `price_asc` — composite index serves **both** filter and order
```
Limit  (actual time=0.105..0.108 rows=20)
  ->  Incremental Sort   Sort Key: price, id   Presorted Key: price
        ->  Index Scan using properties_city_property_type_price_idx on properties
              Index Cond: ((city = 'Austin') AND (property_type = 'house')
                           AND (price >= 300000) AND (price <= 700000))
Execution Time: 0.128 ms
```

### sort = `newest`
```
Limit  (actual time=0.681..0.684 rows=20)
  ->  Sort   Sort Key: created_at DESC, id DESC   (top-N heapsort)
        ->  Bitmap Heap Scan on properties
              ->  Bitmap Index Scan using properties_city_property_type_price_idx
                    Index Cond: ((city = 'Austin') AND (property_type = 'house')
                                 AND (price >= 300000) AND (price <= 700000))
Execution Time: 0.706 ms
```

**Conclusion:** the composite index `properties_city_property_type_price_idx`
(from Session 2) is used in both cases — an **Index Scan / Bitmap Index Scan**,
never a sequential scan. Server-side execution is **0.1–0.7 ms** at 50k rows.
For `price_*` sorts the composite index also satisfies the ordering
(`Presorted Key: price` → Incremental Sort), so there is no expensive full sort.

---

## 2. Connection: pooled vs direct (an important finding)

Measured raw round-trip (`SELECT 1`, warm, 5 samples) to the two Neon endpoints:

| Endpoint | Avg round-trip |
|---|---|
| Pooled (`-pooler`, PgBouncer) | **~1,528 ms** |
| Direct (non-pooled) | **~291 ms** |

On the free tier the **pooler added ~1.2 s per query**. PgBouncer pooling only
helps serverless / many-instance deployments that open connection storms; a
single long-running Node server is faster on a **direct** connection.

**Action taken:** the app runtime now uses the **direct** endpoint
(`DATABASE_URL`). The pooler would be reconsidered only for a serverless deploy.

---

## 3. Response-time benchmark (endpoint, via HTTP)

Endpoint: `GET /api/properties/search?city=Austin&type=house&minBudget=300000&maxBudget=700000&sort=price_asc&limit=20`
Tool: `autocannon`. After switching to the direct connection:

| Metric | Pooled (before) | Direct (after) |
|---|---|---|
| Warm single request | ~2.5 s | **~0.65 s** |
| `autocannon -c 10` median latency | ~2,388 ms | **~614 ms** |
| `autocannon -c 10` throughput | ~3 req/s (7 timeouts) | **~11 req/s, 0 errors** |

---

## 4. Interpreting the numbers

- **The query is not the bottleneck.** `SELECT 1` (~291 ms direct) costs the
  same as the full search without its relation — the index makes the query
  itself effectively free (0.1–0.7 ms server-side, per §1).
- **Latency is network-bound** to a free-tier DB one continent away. Each
  request makes ~2 round-trips (properties, then a batched images load), so
  end-to-end ≈ `2 × RTT` ≈ ~600 ms here.
- **In production** (Session 12) the API and DB would be **colocated in the same
  region**. End-to-end latency then collapses toward the server-side execution
  time — **single-digit milliseconds** — with the same code and indexes.

## 5. Response-shape optimizations applied
- `SELECT` only the columns needed for cards (no `SELECT *`); the search/list
  select is defined once in `property.service.ts` (`listSelect`).
- Cover image only (`images: { take: 1 }`) in list/search payloads.
- Keyset (cursor) pagination — O(log n) seeks, no OFFSET scan cost at 50k+.

## How to reproduce
```bash
npm run seed                      # 50k rows
npm run dev
bash scripts/search-smoke.sh      # correctness (filters, sorts, paging)
# EXPLAIN + load test steps as above (autocannon is a devDependency)
```
