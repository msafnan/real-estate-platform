'use client';

import { useEffect, useRef, useState } from 'react';

interface BlurImageProps {
  src: string;
  alt: string;
  /** Extra classes on the <img> (object-fit, hover transforms, etc.). */
  className?: string;
  /** Load immediately instead of lazily — use only for above-the-fold hero images. */
  eager?: boolean;
}

/**
 * Progressive "blur-up" image (Flipkart-style):
 *  1. A shimmering skeleton fills the box while nothing has painted.
 *  2. The real image is lazy-loaded and starts blurred + transparent.
 *  3. On decode it sharpens and fades in, revealing the picture.
 *
 * Client component (needs the load event + state), kept intentionally tiny so
 * it can be dropped into server-rendered cards/pages as an island.
 */
export function BlurImage({ src, alt, className = '', eager = false }: BlurImageProps) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // If the image was already in cache, `onLoad` may fire before React attaches
  // the handler — check `.complete` on mount so it never gets stuck blurred.
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        aria-hidden
        className={`absolute inset-0 bg-gray-200 transition-opacity duration-700 ${
          loaded ? 'opacity-0' : 'animate-pulse opacity-100'
        }`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`${className} transition-[opacity,filter,transform] duration-700 ease-out ${
          loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-2xl'
        }`}
      />
    </div>
  );
}
