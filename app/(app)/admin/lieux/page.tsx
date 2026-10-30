import { redirect } from 'next/navigation';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';
import { LocationsAdmin } from './locations-admin';

export default async function AdminLieuxPage() {
  const ctx = await getServerSessionContext();
  if (!ctx || !isHrPrivileged(ctx.appRole)) {
    redirect('/dashboard');
  }
  return <LocationsAdmin />;
}
