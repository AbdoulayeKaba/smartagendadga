import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { taskCommentSchema, updateTaskSchema } from '@/lib/workspace/schemas';
import {
  addWorkspaceTaskComment,
  deleteWorkspaceTask,
  getWorkspaceTask,
  updateWorkspaceTask,
} from '@/lib/services/workspace-service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const { id } = await ctx.params;
  const detail = await getWorkspaceTask(id);
  if (!detail) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);

  if (json?.comment !== undefined) {
    const parsed = taskCommentSchema.safeParse({ body: json.comment });
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
    }
    const userName = `${session.firstName ?? ''} ${session.lastName ?? ''}`.trim() || 'Assistante';
    const comment = await addWorkspaceTaskComment(id, session.userId, userName, parsed.data.body);
    return NextResponse.json({ comment });
  }

  const parsed = updateTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const userName = `${session.firstName ?? ''} ${session.lastName ?? ''}`.trim() || 'Assistante';
  const task = await updateWorkspaceTask(
    id,
    {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? null } : {}),
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId ?? null } : {}),
      ...(parsed.data.projectName !== undefined ? { projectName: parsed.data.projectName ?? null } : {}),
      ...(parsed.data.projectPhase !== undefined ? { projectPhase: parsed.data.projectPhase ?? null } : {}),
      ...(parsed.data.assigneeName !== undefined ? { assigneeName: parsed.data.assigneeName } : {}),
      ...(parsed.data.assigneeUserId !== undefined ? { assigneeUserId: parsed.data.assigneeUserId ?? null } : {}),
      ...(parsed.data.startAt !== undefined ? { startAt: parsed.data.startAt ?? null } : {}),
      ...(parsed.data.dueAt !== undefined ? { dueAt: parsed.data.dueAt ?? null } : {}),
      ...(parsed.data.estimatedHours !== undefined ? { estimatedHours: parsed.data.estimatedHours ?? null } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    },
    session.userId,
    userName
  );
  if (!task) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const ok = await deleteWorkspaceTask(id, session.userId);
  if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
