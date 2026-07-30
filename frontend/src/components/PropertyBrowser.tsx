'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, buildSearchQuery } from '../lib/api';
import { API_URL } from '../lib/config';
import { PROPERTY_TYPES, Paginated, PropertyCard as Card, SearchFilters, SortOption } from '../lib/types';
import { titleCase } from '../lib/format';
import { PropertyCard } from './PropertyCard';
import { Button, ErrorMessage, Field, Input, Select, Spinner } from './ui';

const PAGE = 12;

/** Listing grid with filters, sort, and cursor-based "load more". */
export function PropertyBrowser() {
  const [filters, setFilters] = useState<SearchFilters>({ sort: 'newest' });
  const [applied, setApplied] = useState<SearchFilters>({ sort: 'newest' });
  const [items, setItems] = useState<Card[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  const fetchPage = useCallback(
    async (f: SearchFilters, cur: string | null, append: boolean) => {
      const id = ++reqId.current;
      setLoading(true);
      setError('');
      try {
        const qs = buildSearchQuery(f, cur ?? undefined, PAGE);
        const res = await fetch(`${API_URL}/api/properties/search?${qs}`);
        if (!res.ok) throw new ApiError(res.status, 'Failed to load properties');
        const data: Paginated<Card> = await res.json();
        if (id !== reqId.current) return; // stale response, ignore
        setItems((prev) => (append ? [...prev, ...data.data] : data.data));
        setCursor(data.nextCursor);
      } catch (err) {
        if (id === reqId.current) setError(err instanceof Error ? err.message : 'Error');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [],
  );

  // Initial load.
  useEffect(() => {
    fetchPage({ sort: 'newest' }, null, false);
  }, [fetchPage]);

  function applyFilters() {
    setApplied(filters);
    setItems([]);
    setCursor(null);
    fetchPage(filters, null, false);
  }

  function reset() {
    const cleared: SearchFilters = { sort: 'newest' };
    setFilters(cleared);
    setApplied(cleared);
    setItems([]);
    setCursor(null);
    fetchPage(cleared, null, false);
  }

  const num = (v: string): number | undefined => (v === '' ? undefined : Number(v));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-6">
        <Field label="City">
          <Input
            placeholder="Any"
            value={filters.city ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value || undefined }))}
          />
        </Field>
        <Field label="Type">
          <Select
            value={filters.type ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, type: (e.target.value || undefined) as SearchFilters['type'] }))
            }
          >
            <option value="">Any</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Min $">
          <Input
            type="number"
            placeholder="0"
            value={filters.minBudget ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, minBudget: num(e.target.value) }))}
          />
        </Field>
        <Field label="Max $">
          <Input
            type="number"
            placeholder="Any"
            value={filters.maxBudget ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, maxBudget: num(e.target.value) }))}
          />
        </Field>
        <Field label="Beds (min)">
          <Input
            type="number"
            placeholder="Any"
            value={filters.bedrooms ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, bedrooms: num(e.target.value) }))}
          />
        </Field>
        <Field label="Sort">
          <Select
            value={filters.sort ?? 'newest'}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as SortOption }))}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
          </Select>
        </Field>
        <div className="col-span-2 flex items-end gap-2 md:col-span-6">
          <Button onClick={applyFilters}>Apply</Button>
          <Button variant="secondary" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      <ErrorMessage message={error} />

      {/* Results */}
      {items.length === 0 && !loading ? (
        <p className="py-12 text-center text-gray-500">No properties match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}

      {loading && <Spinner label="Loading…" />}

      {cursor && !loading && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => fetchPage(applied, cursor, true)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
