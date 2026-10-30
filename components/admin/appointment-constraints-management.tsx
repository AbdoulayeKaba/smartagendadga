'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirige vers Horaires & créneaux (contraintes intégrées). */
export function AppointmentConstraintsManagement() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dg/admin/referentials?tab=horaires');
  }, [router]);
  return (
    <p className="text-sm text-muted-foreground">Redirection vers Horaires & créneaux…</p>
  );
}
