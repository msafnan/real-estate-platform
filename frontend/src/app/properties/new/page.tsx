'use client';

import { PropertyForm } from '../../../components/PropertyForm';
import { ProtectedRoute } from '../../../components/ProtectedRoute';

export default function NewPropertyPage() {
  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Create a listing</h1>
        <PropertyForm mode="create" />
      </div>
    </ProtectedRoute>
  );
}
