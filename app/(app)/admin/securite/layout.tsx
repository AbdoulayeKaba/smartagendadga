import { redirect } from 'next/navigation';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';

export default async function AdminSecuriteLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getServerSessionContext();
  if (!ctx || !isHrFamily(ctx.appRole)) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
