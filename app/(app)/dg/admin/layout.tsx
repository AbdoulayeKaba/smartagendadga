import { redirect } from 'next/navigation';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { getDgSession } from '@/lib/auth/session-server';
import { homePathForRoleId } from '@/lib/auth/post-login-redirect';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getDgSession();
  if (!session || !(await userHasPermission(session.role, 'admin.platform'))) {
    redirect(session ? await homePathForRoleId(session.role) : '/login');
  }
  return <>{children}</>;
}
