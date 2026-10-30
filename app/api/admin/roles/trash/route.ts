import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { emptyRolesTrashAdmin } from '@/lib/services/role-permissions-admin';

export async function POST() {
  const auth = await requireApiPermission('admin.roles.permissions', ['ASSISTANT']);
  if (auth.error) return auth.error;
  const { session } = auth;

  const result = await emptyRolesTrashAdmin(session.userId);
  return NextResponse.json(result);
}
