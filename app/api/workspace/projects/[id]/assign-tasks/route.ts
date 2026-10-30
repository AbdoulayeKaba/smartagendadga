import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { assignTasksToProjectSchema } from '@/lib/workspace/schemas';
import { assignWorkspaceTasksToProject } from '@/lib/services/workspace-service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const parsed = assignTasksToProjectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const project = await assignWorkspaceTasksToProject(
    id,
    parsed.data.taskIds,
    parsed.data.projectPhase,
    session.userId
  );
  if (!project) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ project });
}
