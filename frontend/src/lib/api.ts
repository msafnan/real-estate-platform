import { API_URL, SERVER_API_URL } from './config';
import { Paginated, Property, PropertyCard, SearchFilters } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Parse a backend error envelope into an ApiError. */
async function toError(res: Response): Promise<ApiError> {
  let message = res.statusText;
  let code: string | undefined;
  try {
    const body = await res.json();
    message = body?.error?.message ?? message;
    code = body?.error?.code;
  } catch {
    /* non-JSON error */
  }
  return new ApiError(res.status, message, code);
}

/**
 * Server-side / public fetch (no auth). Used by Server Components for public
 * GETs. `revalidate` enables ISR caching.
 */
export async function serverFetch<T>(
  path: string,
  opts: { revalidate?: number } = {},
): Promise<T> {
  const res = await fetch(`${SERVER_API_URL}${path}`, {
    next: opts.revalidate != null ? { revalidate: opts.revalidate } : undefined,
    cache: opts.revalidate != null ? undefined : 'no-store',
  });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

// ---- Public read helpers ----

export function buildSearchQuery(filters: SearchFilters, cursor?: string, limit = 12): string {
  const p = new URLSearchParams();
  if (filters.city) p.set('city', filters.city);
  if (filters.type) p.set('type', filters.type);
  if (filters.minBudget != null) p.set('minBudget', String(filters.minBudget));
  if (filters.maxBudget != null) p.set('maxBudget', String(filters.maxBudget));
  if (filters.bedrooms != null) p.set('bedrooms', String(filters.bedrooms));
  if (filters.sort) p.set('sort', filters.sort);
  if (cursor) p.set('cursor', cursor);
  p.set('limit', String(limit));
  return p.toString();
}

export const getProperty = (id: string) =>
  serverFetch<Property>(`/api/properties/${id}`, { revalidate: 3600 });

export const getSimilar = (id: string) =>
  serverFetch<PropertyCard[]>(`/api/properties/${id}/similar`, { revalidate: 3600 });

export const searchProperties = (filters: SearchFilters, cursor?: string) =>
  serverFetch<Paginated<PropertyCard>>(
    `/api/properties/search?${buildSearchQuery(filters, cursor)}`,
  );

// Client-side raw fetch helper (returns Response for callers that need status).
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init?.headers ?? {}) },
  });
}

export { API_URL };
