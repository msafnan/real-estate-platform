'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BlurImage } from '../../components/BlurImage';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { Button, ErrorMessage, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { formatPrice, titleCase } from '../../lib/format';
import { Paginated, PropertyCard as Card } from '../../lib/types';

function Dashboard() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<Card[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (cur?: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ limit: '20', ...(cur ? { cursor: cur } : {}) });
        const res = await authFetch(`/api/properties/mine?${qs.toString()}`);
        if (!res.ok) throw new Error('Failed to load your listings');
        const data: Paginated<Card> = await res.json();
        setItems((prev) => (cur ? [...prev, ...data.data] : data.data));
        setCursor(data.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(id: string) {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    const res = await authFetch(`/api/properties/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((p) => p.id !== id));
    else setError('Could not delete listing.');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My listings</h1>
        <Link href="/properties/new">
          <Button>+ New listing</Button>
        </Link>
      </div>

      <ErrorMessage message={error} />

      {loading && items.length === 0 ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-gray-500">
          You have no listings yet.{' '}
          <Link href="/properties/new" className="font-medium text-gray-900 underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <div className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded bg-gray-100">
                {p.images?.[0]?.url && (
                  <BlurImage src={p.images[0].url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/properties/${p.id}`} className="truncate font-medium hover:underline">
                  {p.title}
                </Link>
                <p className="text-sm text-gray-500">
                  {formatPrice(p.price)} · {titleCase(p.propertyType)} · {p.city}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/properties/${p.id}/edit`}>
                  <Button variant="secondary">Edit</Button>
                </Link>
                <Button variant="danger" onClick={() => onDelete(p.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cursor && !loading && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => load(cursor)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
