'use client';

import { useEffect, useState } from 'react';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/** Rend les enfants uniquement après hydratation (évite les IDs Radix divergents SSR/client). */
export function ClientMount({ children, fallback = null }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
