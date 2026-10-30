import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { parseRoleId } from '@/lib/dg/role-ids';
import { getRolePermissionLabels } from '@/lib/services/role-permissions-admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roleId: string }> }
) {
  let auth = await requireApiPermission('admin.users.read');
  if (auth.error) {
    auth = await requireApiPermission('admin.roles.permissions');
  }
  if (auth.error) return auth.error;

  const { roleId: raw } = await params;
  const roleId = parseRoleId(raw);
  if (!roleId) {
    return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 400 });
  }

  const labels = await getRolePermissionLabels(roleId);
  return NextResponse.json({ labels });
}
