'use client';

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';

export function Navbar() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/properties" className="text-lg font-bold tracking-tight">
          🏡 Estate
        </Link>

        <div className="flex items-center gap-3 text-sm">
          <Link href="/properties" className="text-gray-600 hover:text-gray-900">
            Browse
          </Link>

          {loading ? null : user ? (
            <>
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                My Listings
              </Link>
              <Link href="/properties/new">
                <Button variant="secondary">+ New Listing</Button>
              </Link>
              <span className="hidden text-gray-400 sm:inline">·</span>
              <span className="hidden text-gray-600 sm:inline">{user.email}</span>
              <Button variant="secondary" onClick={() => logout()}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-600 hover:text-gray-900">
                Log in
              </Link>
              <Link href="/register">
                <Button>Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
