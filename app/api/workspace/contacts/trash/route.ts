import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { emptyWorkspaceContactsTrash } from '@/lib/services/workspace-service';

export async function POST() {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!(await userHasPermission(session.role, 'action.contacts.delete'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await emptyWorkspaceContactsTrash(session.userId);
  return NextResponse.json(result);
}
