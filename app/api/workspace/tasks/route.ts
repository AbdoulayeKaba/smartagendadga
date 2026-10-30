import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createTaskSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { createWorkspaceTask, listWorkspaceTasks } from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;

  const url = new URL(req.url);
  const items = await listWorkspaceTasks({
    status: url.searchParams.get('status') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    year: parseYearFromRequest(url),
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const userName = `${session.firstName ?? ''} ${session.lastName ?? ''}`.trim() || 'Assistante';
  const task = await createWorkspaceTask(
    {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      priority: parsed.data.priority,
      projectId: parsed.data.projectId ?? null,
      projectName: parsed.data.projectName ?? null,
      projectPhase: parsed.data.projectPhase ?? null,
      assigneeName: parsed.data.assigneeName,
      assigneeUserId: parsed.data.assigneeUserId ?? null,
      startAt: parsed.data.startAt ?? null,
      dueAt: parsed.data.dueAt ?? null,
      estimatedHours: parsed.data.estimatedHours ?? null,
      createdById: session.userId,
    },
    session.userId,
    userName
  );
  return NextResponse.json({ task }, { status: 201 });
}
