import { z } from 'zod';

const PROPERTY_TYPES = [
  'apartment',
  'house',
  'condo',
  'townhouse',
  'land',
  'commercial',
] as const;

// Scalar listing fields (no images — images are managed via their own routes).
const scalarFields = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  price: z.number().int().positive().max(1_000_000_000),
  city: z.string().min(1).max(100),
  propertyType: z.enum(PROPERTY_TYPES),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
});

export const createPropertySchema = z.object({
  body: scalarFields.extend({
    // Optional image URLs at creation time (file uploads use the multipart endpoint).
    imageUrls: z.array(z.string().url()).max(10).optional(),
  }),
});

// Update: same scalar fields, all optional, but at least one must be present.
export const updatePropertySchema = z.object({
  body: scalarFields.partial().refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field is required',
  }),
});

export const listPropertiesSchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid property id') }),
});

export const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const searchPropertiesSchema = z.object({
  query: z
    .object({
      city: z.string().min(1).max(100).optional(),
      type: z.enum(PROPERTY_TYPES).optional(),
      minBudget: z.coerce.number().int().min(0).optional(),
      maxBudget: z.coerce.number().int().min(0).optional(),
      // Treated as a minimum ("N+ bedrooms").
      bedrooms: z.coerce.number().int().min(0).max(50).optional(),
      sort: z.enum(SORT_OPTIONS).optional().default('newest'),
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    })
    .refine(
      (q) => q.minBudget == null || q.maxBudget == null || q.minBudget <= q.maxBudget,
      { message: 'minBudget must be ≤ maxBudget', path: ['minBudget'] },
    ),
});

export type SearchQuery = z.infer<typeof searchPropertiesSchema>['query'];

export type CreatePropertyInput = z.infer<typeof createPropertySchema>['body'];
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>['body'];
