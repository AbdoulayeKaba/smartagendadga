import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { emptyWorkspaceMissionsTrash } from '@/lib/services/workspace-service';

export async function POST() {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!(await userHasPermission(session.role, 'action.missions.delete'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await emptyWorkspaceMissionsTrash(session.userId);
  return NextResponse.json(result);
}
