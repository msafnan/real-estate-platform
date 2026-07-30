'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PropertyForm } from '../../../../components/PropertyForm';
import { ProtectedRoute } from '../../../../components/ProtectedRoute';
import { ErrorMessage, Spinner } from '../../../../components/ui';
import { API_URL } from '../../../../lib/config';
import { Property } from '../../../../lib/types';

export default function EditPropertyPage() {
  const params = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/properties/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load property'))))
      .then(setProperty)
      .catch((e) => setError(e.message));
  }, [params.id]);

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Edit listing</h1>
        <ErrorMessage message={error} />
        {!property && !error ? (
          <Spinner label="Loading…" />
        ) : property ? (
          <PropertyForm mode="edit" initial={property} />
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
