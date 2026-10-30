import { redirect } from 'next/navigation';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrPrivileged } from '@/lib/auth/rbac';

export default async function SchoolAdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getServerSessionContext();
  if (!ctx || !isHrPrivileged(ctx.appRole)) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
