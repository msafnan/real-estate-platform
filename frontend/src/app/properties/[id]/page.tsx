import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlurImage } from '../../../components/BlurImage';
import { InquiryForm } from '../../../components/InquiryForm';
import { OwnerActions } from '../../../components/OwnerActions';
import { PropertyCard } from '../../../components/PropertyCard';
import { ApiError, getProperty, getSimilar } from '../../../lib/api';
import { formatPrice, titleCase } from '../../../lib/format';
import { PropertyCard as Card } from '../../../lib/types';

// ISR: detail pages are statically served and revalidated hourly (D-7).
export const revalidate = 3600;

interface Params {
  params: { id: string };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  try {
    const p = await getProperty(params.id);
    const desc = `${titleCase(p.propertyType)} in ${p.city} — ${p.bedrooms} bed, ${p.bathrooms} bath. ${formatPrice(p.price)}.`;
    const image = p.images?.[0]?.url;
    return {
      title: p.title,
      description: desc,
      openGraph: {
        title: p.title,
        description: desc,
        type: 'website',
        images: image ? [{ url: image }] : undefined,
      },
      twitter: {
        card: image ? 'summary_large_image' : 'summary',
        title: p.title,
        description: desc,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return { title: 'Property' };
  }
}

export default async function PropertyDetailPage({ params }: Params) {
  let property;
  try {
    property = await getProperty(params.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  let similar: Card[] = [];
  try {
    similar = await getSimilar(params.id);
  } catch {
    /* similar is non-critical */
  }

  return (
    <div className="space-y-10">
      <Link href="/properties" className="text-sm text-gray-500 hover:text-gray-800">
        ← Back to listings
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-6 lg:col-span-2">
          <Gallery images={property.images.map((i) => i.url)} title={property.title} />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{property.title}</h1>
              <p className="text-gray-500">
                {titleCase(property.propertyType)} · {property.city}
              </p>
            </div>
            <p className="text-2xl font-bold">{formatPrice(property.price)}</p>
          </div>
          <div className="flex gap-6 text-sm text-gray-700">
            <span>{property.bedrooms} bedrooms</span>
            <span>{property.bathrooms} bathrooms</span>
          </div>
          <OwnerActions propertyId={property.id} ownerId={property.ownerId} />
          <div>
            <h2 className="mb-2 text-lg font-semibold">Description</h2>
            <p className="whitespace-pre-line text-gray-700">{property.description}</p>
          </div>
        </div>

        {/* Sidebar: inquiry */}
        <aside className="lg:col-span-1">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <InquiryForm propertyId={property.id} />
          </div>
        </aside>
      </div>

      {/* Similar */}
      {similar.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Similar properties</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Gallery({ images, title }: { images: string[]; title: string }) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-gray-100 text-gray-400">
        No images
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
        <BlurImage src={images[0]} alt={title} eager className="h-full w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.slice(1, 5).map((url, i) => (
            <div
              key={i}
              className="aspect-square w-full overflow-hidden rounded-md bg-gray-100"
            >
              <BlurImage
                src={url}
                alt={`${title} ${i + 2}`}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
