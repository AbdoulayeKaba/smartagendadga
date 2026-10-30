'use client';

import { useState } from 'react';
import { countryFlagSources } from '@/lib/workspace/mission-countries';
import { cn } from '@/lib/utils';

type Props = {
  code: string;
  size?: 'sm' | 'md';
  className?: string;
};

const SIZES = {
  sm: { width: 16, height: 12 },
  md: { width: 20, height: 15 },
} as const;

export function CountryFlagImage({ code, size = 'md', className }: Props) {
  const sources = countryFlagSources(code);
  const [sourceIndex, setSourceIndex] = useState(0);
  const dims = SIZES[size];

  if (sourceIndex >= sources.length) {
    return (
      <span
        className={cn(
          'country-multi-select-flag country-multi-select-flag--empty',
          size === 'sm' && 'country-multi-select-flag--sm',
          className
        )}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={sources[sourceIndex]}
      alt=""
      width={dims.width}
      height={dims.height}
      className={cn(
        'country-multi-select-flag-img',
        size === 'sm' && 'country-multi-select-flag-img--sm',
        className
      )}
      loading="lazy"
      decoding="async"
      onError={() => setSourceIndex((index) => index + 1)}
    />
  );
}
