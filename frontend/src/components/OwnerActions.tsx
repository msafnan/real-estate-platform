'use client';

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';

/** Shows Edit/Manage actions only to the listing's owner. */
export function OwnerActions({ propertyId, ownerId }: { propertyId: string; ownerId: string }) {
  const { user } = useAuth();
  if (!user || user.id !== ownerId) return null;
  return (
    <div className="flex gap-2">
      <Link href={`/properties/${propertyId}/edit`}>
        <Button variant="secondary">Edit listing</Button>
      </Link>
      <Link href="/dashboard">
        <Button variant="secondary">My listings</Button>
      </Link>
    </div>
  );
}
