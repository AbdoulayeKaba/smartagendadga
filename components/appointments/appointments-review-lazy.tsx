'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

export const AppointmentsReviewLazy = dynamic(
  () =>
    import('@/components/appointments/appointments-review').then(
      (mod) => mod.AppointmentsReview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[12rem] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Chargement des rendez-vous…</span>
      </div>
    ),
  }
);
