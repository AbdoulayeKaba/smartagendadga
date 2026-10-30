import { redirect } from 'next/navigation';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { isHrFamily } from '@/lib/auth/rbac';
import { AttendanceRhDashboard } from './rh-dashboard';

export default async function PointageRhPage() {
  const ctx = await getServerSessionContext();
  if (!ctx || !isHrFamily(ctx.appRole)) {
    redirect('/pointage');
  }
  return <AttendanceRhDashboard />;
}
