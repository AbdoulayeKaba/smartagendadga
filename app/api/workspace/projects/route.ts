import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createProjectSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { createWorkspaceProject, listWorkspaceProjects } from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  const items = await listWorkspaceProjects({ year: parseYearFromRequest(url) });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = createProjectSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  const project = await createWorkspaceProject(
    {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      ownerName: parsed.data.ownerName,
      ownerUserId: parsed.data.ownerUserId ?? null,
      phases: parsed.data.phases,
      startAt: parsed.data.startAt ?? null,
      dueAt: parsed.data.dueAt ?? null,
    },
    session.userId
  );
  return NextResponse.json({ project }, { status: 201 });
}
