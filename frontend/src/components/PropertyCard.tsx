import Link from 'next/link';
import { BlurImage } from './BlurImage';
import { formatPrice, titleCase } from '../lib/format';
import { PropertyCard as PropertyCardType } from '../lib/types';

export function PropertyCard({ property }: { property: PropertyCardType }) {
  const cover = property.images?.[0]?.url;
  return (
    <Link
      href={`/properties/${property.id}`}
      className="group overflow-hidden rounded-lg border border-gray-200 bg-white transition hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
        {cover ? (
          <BlurImage
            src={cover}
            alt={property.title}
            className="h-full w-full object-cover group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">No image</div>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="text-lg font-semibold">{formatPrice(property.price)}</p>
        <p className="truncate text-sm font-medium text-gray-800">{property.title}</p>
        <p className="text-sm text-gray-500">
          {titleCase(property.propertyType)} · {property.city}
        </p>
        <p className="text-xs text-gray-500">
          {property.bedrooms} bd · {property.bathrooms} ba
        </p>
      </div>
    </Link>
  );
}
