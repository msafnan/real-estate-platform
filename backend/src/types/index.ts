/**
 * Shared domain types / DTOs — reused across models, controllers and services.
 * Defined early (Session 1) so the whole codebase speaks one vocabulary.
 * These mirror the DB schema that is formally designed in Session 2; once
 * Prisma models exist, prefer Prisma-generated types and keep these as the
 * API-facing DTO shapes.
 */

export type PropertyType = 'apartment' | 'house' | 'condo' | 'townhouse' | 'land' | 'commercial';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/** User as persisted (includes the secret; never send this over the wire). */
export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface Property {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  price: number;
  city: string;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PropertyImage {
  id: string;
  propertyId: string;
  /** Only the URL is stored in the DB — binaries live in cloud storage (D-4). */
  url: string;
  position: number;
  createdAt: Date;
}

export interface Inquiry {
  id: string;
  propertyId: string;
  inquirerName: string;
  inquirerEmail: string;
  inquirerPhone?: string;
  message: string;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Shape attached to req.user by authMiddleware (Session 3). */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/** Standard cursor-paginated response envelope (keyset pagination, D-5). */
export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

/** Consistent JSON error shape across the API (D-13). */
export interface ApiError {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}
