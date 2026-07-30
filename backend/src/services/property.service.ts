import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middleware/error.middleware';
import {
  decodeCursor,
  encodeCursor,
  keysetWhere,
} from '../utils/pagination';
import { storageService } from './storage.service';
import { TTLCache } from '../utils/cache';
import {
  CreatePropertyInput,
  SearchQuery,
  UpdatePropertyInput,
} from '../validators/property.validators';

/** Similar-properties are read-heavy and stable — cache briefly (Session 6). */
const similarCache = new TTLCache<unknown>(60_000);

/** Columns returned for list views — avoids over-fetching (Session 5 note). */
const listSelect = {
  id: true,
  ownerId: true,
  title: true,
  price: true,
  city: true,
  propertyType: true,
  bedrooms: true,
  bathrooms: true,
  createdAt: true,
  images: {
    select: { id: true, url: true, position: true },
    orderBy: { position: 'asc' as const },
    take: 1, // list shows a cover image only
  },
} satisfies Prisma.PropertySelect;

export const propertyService = {
  async create(ownerId: string, input: CreatePropertyInput) {
    const { imageUrls, ...fields } = input;
    return prisma.property.create({
      data: {
        ...fields,
        ownerId,
        images: imageUrls
          ? { create: imageUrls.map((url, i) => ({ url, position: i })) }
          : undefined,
      },
      include: { images: { orderBy: { position: 'asc' } } },
    });
  },

  async getById(id: string) {
    const property = await prisma.property.findUnique({
      where: { id },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    if (!property) throw new HttpError(404, 'Property not found', 'NOT_FOUND');
    return property;
  },

  async update(id: string, input: UpdatePropertyInput) {
    similarCache.delete(id); // city/type/price may have changed
    return prisma.property.update({
      where: { id },
      data: input,
      include: { images: { orderBy: { position: 'asc' } } },
    });
  },

  /** Delete a property, removing its Cloudinary assets first (best-effort). */
  async remove(id: string) {
    const images = await prisma.propertyImage.findMany({
      where: { propertyId: id },
      select: { publicId: true },
    });
    const publicIds = images.map((i) => i.publicId).filter((p): p is string => Boolean(p));
    await storageService.deleteImages(publicIds);
    // Cascade removes property_images + inquiries rows.
    await prisma.property.delete({ where: { id } });
    similarCache.delete(id);
  },

  /** Keyset-paginated list, newest first (D-5). Optionally scoped to an owner. */
  async list(rawCursor: string | undefined, limit: number, ownerId?: string) {
    const cursor = rawCursor ? decodeCursor(rawCursor) : null;
    if (rawCursor && !cursor) {
      throw new HttpError(400, 'Invalid cursor', 'INVALID_CURSOR');
    }

    const where: Prisma.PropertyWhereInput = { ...keysetWhere(cursor) };
    if (ownerId) where.ownerId = ownerId;

    // Fetch one extra row to know whether another page exists.
    const rows = await prisma.property.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: listSelect,
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last) : null;

    return { data, nextCursor };
  },

  /**
   * Filtered search with sort + keyset pagination at scale (Session 5, D-5).
   * The cursor token encodes the sort key value + id, so paging is correct for
   * each sort order. Filters on city/type/price hit the composite index
   * (city, property_type, price) — verified with EXPLAIN ANALYZE.
   */
  async search(q: SearchQuery) {
    // ---- filters ----
    const filters: Prisma.PropertyWhereInput = {};
    if (q.city) filters.city = q.city;
    if (q.type) filters.propertyType = q.type;
    if (q.bedrooms != null) filters.bedrooms = { gte: q.bedrooms };
    if (q.minBudget != null || q.maxBudget != null) {
      filters.price = {
        ...(q.minBudget != null ? { gte: q.minBudget } : {}),
        ...(q.maxBudget != null ? { lte: q.maxBudget } : {}),
      };
    }

    // ---- sort + keyset cursor ----
    let orderBy: Prisma.PropertyOrderByWithRelationInput[];
    let keyset: Prisma.PropertyWhereInput | undefined;

    let cur: { value: string; id: string } | null = null;
    if (q.cursor) {
      const raw = Buffer.from(q.cursor, 'base64url').toString('utf8');
      const [value, id] = raw.split('|');
      if (!id) throw new HttpError(400, 'Invalid cursor', 'INVALID_CURSOR');
      cur = { value, id };
    }

    switch (q.sort) {
      case 'price_asc':
        orderBy = [{ price: 'asc' }, { id: 'asc' }];
        if (cur) {
          const p = Number(cur.value);
          keyset = { OR: [{ price: { gt: p } }, { price: p, id: { gt: cur.id } }] };
        }
        break;
      case 'price_desc':
        orderBy = [{ price: 'desc' }, { id: 'desc' }];
        if (cur) {
          const p = Number(cur.value);
          keyset = { OR: [{ price: { lt: p } }, { price: p, id: { lt: cur.id } }] };
        }
        break;
      case 'newest':
      default: {
        orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
        if (cur) {
          const d = new Date(cur.value);
          keyset = { OR: [{ createdAt: { lt: d } }, { createdAt: d, id: { lt: cur.id } }] };
        }
        break;
      }
    }

    const where: Prisma.PropertyWhereInput = keyset ? { AND: [filters, keyset] } : filters;

    const rows = await prisma.property.findMany({
      where,
      orderBy,
      take: q.limit + 1,
      select: listSelect,
    });

    const hasMore = rows.length > q.limit;
    const data = hasMore ? rows.slice(0, q.limit) : rows;
    const last = data[data.length - 1];

    let nextCursor: string | null = null;
    if (hasMore && last) {
      const value =
        q.sort === 'newest' ? last.createdAt.toISOString() : String(last.price);
      nextCursor = Buffer.from(`${value}|${last.id}`, 'utf8').toString('base64url');
    }

    return { data, nextCursor };
  },

  /**
   * Similar properties (Session 6, algorithm from DECISIONS D-6):
   * same city + same type + price within ±20%, excluding the current listing,
   * ranked by relevance (closest price first, then newest), LIMIT 6.
   *
   * Uses the composite index (city, property_type, price) for the WHERE; a raw
   * query does the ABS(price - base) relevance ordering, then rows are hydrated
   * with Prisma (to reuse listSelect + cover image). Cached ~60s.
   */
  async getSimilar(id: string) {
    const cached = similarCache.get(id);
    if (cached) return cached;

    const base = await prisma.property.findUnique({
      where: { id },
      select: { id: true, city: true, propertyType: true, price: true },
    });
    if (!base) throw new HttpError(404, 'Property not found', 'NOT_FOUND');

    const min = Math.round(base.price * 0.8);
    const max = Math.round(base.price * 1.2);

    // Ordered ids by relevance (closest price, then newest).
    const ranked = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM properties
      WHERE city = ${base.city}
        AND property_type = ${base.propertyType}::"PropertyType"
        AND price BETWEEN ${min} AND ${max}
        AND id <> ${base.id}
      ORDER BY ABS(price - ${base.price}) ASC, created_at DESC
      LIMIT 6;
    `;
    const ids = ranked.map((r) => r.id);

    // Hydrate with the shared list projection (+ cover image), then restore order.
    const rows = await prisma.property.findMany({
      where: { id: { in: ids } },
      select: listSelect,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const result = ids.map((rid) => byId.get(rid)).filter(Boolean);

    similarCache.set(id, result);
    return result;
  },

  /** Attach uploaded images (already stored) to a property. */
  async addImages(propertyId: string, images: { url: string; publicId: string }[]) {
    const existing = await prisma.propertyImage.count({ where: { propertyId } });
    await prisma.propertyImage.createMany({
      data: images.map((img, i) => ({
        propertyId,
        url: img.url,
        publicId: img.publicId,
        position: existing + i,
      })),
    });
    return prisma.propertyImage.findMany({
      where: { propertyId },
      orderBy: { position: 'asc' },
    });
  },

  /** Remove a single image (from a property the caller owns) + Cloudinary. */
  async removeImage(propertyId: string, imageId: string) {
    const image = await prisma.propertyImage.findFirst({
      where: { id: imageId, propertyId },
    });
    if (!image) throw new HttpError(404, 'Image not found', 'NOT_FOUND');
    if (image.publicId) await storageService.deleteImages([image.publicId]);
    await prisma.propertyImage.delete({ where: { id: imageId } });
  },
};
