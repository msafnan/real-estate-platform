'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

/**
 * Client-side guard for pages that require login (My Listings, Create/Edit).
 * Redirects to /login once the initial silent-refresh resolves with no user.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) return <Spinner label="Loading…" />;
  if (!user) return <Spinner label="Redirecting…" />;
  return <>{children}</>;
}
