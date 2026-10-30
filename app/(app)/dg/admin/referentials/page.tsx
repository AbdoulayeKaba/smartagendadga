import { Suspense } from 'react';
import { ReferentialsManagement } from '@/components/admin/referentials-management';

export default function AdminReferentialsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
      <ReferentialsManagement />
    </Suspense>
  );
}
