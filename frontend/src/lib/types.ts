// Frontend DTOs — mirror the backend API response shapes.

export type PropertyType =
  | 'apartment'
  | 'house'
  | 'condo'
  | 'townhouse'
  | 'land'
  | 'commercial';

export const PROPERTY_TYPES: PropertyType[] = [
  'apartment',
  'house',
  'condo',
  'townhouse',
  'land',
  'commercial',
];

/** Cities available in the seed data — used for the location filter dropdown. */
export const CITIES: string[] = [
  'Atlanta',
  'Austin',
  'Boston',
  'Charlotte',
  'Chicago',
  'Columbus',
  'Dallas',
  'Denver',
  'Houston',
  'Miami',
  'Minneapolis',
  'Nashville',
  'Orlando',
  'Phoenix',
  'Portland',
  'Raleigh',
  'Sacramento',
  'San Diego',
  'Seattle',
  'Tampa',
];

export interface PropertyImage {
  id: string;
  url: string;
  position: number;
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
  createdAt: string;
  images: PropertyImage[];
}

/** Card projection returned by list/search (may omit description). */
export type PropertyCard = Omit<Property, 'description'> & { description?: string };

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface Inquiry {
  id: string;
  propertyId: string;
  inquirerName: string;
  inquirerEmail: string;
  inquirerPhone?: string | null;
  message: string;
  createdAt: string;
}

export type SortOption = 'newest' | 'price_asc' | 'price_desc';

export interface SearchFilters {
  city?: string;
  type?: PropertyType;
  minBudget?: number;
  maxBudget?: number;
  bedrooms?: number;
  sort?: SortOption;
}
