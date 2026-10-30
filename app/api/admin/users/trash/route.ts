import { NextResponse } from 'next/server';
import { requireApiPermission, userHasPermission } from '@/lib/auth/permission-guard';
import { emptyUsersTrash } from '@/lib/services/users-admin';

export async function POST() {
  const auth = await requireApiPermission('admin.users.update');
  if (auth.error) return auth.error;
  const { session } = auth;
  if (!(await userHasPermission(session!.role, 'action.users.delete'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await emptyUsersTrash(session!.userId);
  return NextResponse.json(result);
}
