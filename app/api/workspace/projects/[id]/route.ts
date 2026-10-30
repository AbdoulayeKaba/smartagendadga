import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { updateProjectSchema } from '@/lib/workspace/schemas';
import {
  deleteWorkspaceProject,
  getWorkspaceProject,
  updateWorkspaceProject,
} from '@/lib/services/workspace-service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const { id } = await ctx.params;
  const project = await getWorkspaceProject(id);
  if (!project) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const parsed = updateProjectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const project = await updateWorkspaceProject(
    id,
    {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? null } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.ownerName !== undefined ? { ownerName: parsed.data.ownerName } : {}),
      ...(parsed.data.ownerUserId !== undefined ? { ownerUserId: parsed.data.ownerUserId ?? null } : {}),
      ...(parsed.data.phases !== undefined ? { phases: parsed.data.phases } : {}),
      ...(parsed.data.startAt !== undefined ? { startAt: parsed.data.startAt ?? null } : {}),
      ...(parsed.data.dueAt !== undefined ? { dueAt: parsed.data.dueAt ?? null } : {}),
    },
    session.userId
  );
  if (!project) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const ok = await deleteWorkspaceProject(id, session.userId);
  if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
