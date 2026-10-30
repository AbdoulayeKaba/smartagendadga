'use client';

import { Suspense } from 'react';
import { AppointmentsReviewLazy } from '@/components/appointments/appointments-review-lazy';
import { DgRouteLoading } from '@/components/layout/dg-route-loading';

export default function AppointmentsListPage() {
  return (
    <div className="app-page admin-theme admin-appt-page admin-appt-page--compact">
      <Suspense fallback={<DgRouteLoading />}>
        <AppointmentsReviewLazy />
      </Suspense>
    </div>
  );
}
