'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Inquiry } from '../lib/types';
import { ErrorMessage } from './ui';

/** Owner-only list of inquiries (leads) submitted on a listing. */
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
              <span className="text-gray-400">{new Date(q.createdAt).toLocaleString()}</span>
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
