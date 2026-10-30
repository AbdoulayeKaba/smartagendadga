'use client';

import { useEffect, useState } from 'react';
import {
  getCachedLogoSrc,
  loadLogoWithoutWhiteBackground,
} from '@/lib/images/strip-logo-background';
import { cn } from '@/lib/utils';

type Props = {
  src: string;
  alt?: string;
  className?: string;
};

export function InstitutionLogoImage({ src, alt = '', className }: Props) {
  const trimmed = src?.trim() ?? '';
  // Toujours la même src initiale SSR/client — le cache ne doit pas diverger au 1er paint.
  const [displaySrc, setDisplaySrc] = useState(trimmed);

  useEffect(() => {
    if (!trimmed) return;
    const cached = getCachedLogoSrc(trimmed);
    if (cached) {
      setDisplaySrc(cached);
      return;
    }
    let cancelled = false;
    void loadLogoWithoutWhiteBackground(trimmed).then((result) => {
      if (!cancelled) setDisplaySrc(result);
    });
    return () => {
      cancelled = true;
    };
  }, [trimmed]);

  if (!trimmed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={displaySrc} alt={alt} className={cn('institution-logo-img', className)} />
  );
}
