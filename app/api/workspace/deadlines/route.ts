import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createDeadlineSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { createWorkspaceDeadline, listWorkspaceDeadlines } from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  const items = await listWorkspaceDeadlines({ year: parseYearFromRequest(url) });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = createDeadlineSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const deadline = await createWorkspaceDeadline(
    {
      title: parsed.data.title,
      kind: parsed.data.kind,
      dueAt: parsed.data.dueAt,
      ownerName: parsed.data.ownerName,
      description: parsed.data.description ?? null,
      alertDaysBefore: parsed.data.alertDaysBefore,
    },
    session.userId
  );
  return NextResponse.json({ deadline }, { status: 201 });
}
