import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';

type Ctx = { params: Promise<{ id: string }> };

export async function requireWorkspaceManage(roles: ('ASSISTANT' | 'DG')[] = ['ASSISTANT', 'DG']) {
  const { session, error } = await requireApiSession(roles);
  if (error) return { session: null, error };
  if (!canManageWorkspace(session.role)) {
    return { session: null, error: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
  }
  return { session, error: null };
}

export type { Ctx };
