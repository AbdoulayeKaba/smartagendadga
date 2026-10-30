import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createDecisionSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { createWorkspaceDecision, listWorkspaceDecisions } from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  const items = await listWorkspaceDecisions({
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

  const parsed = createDecisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const decision = await createWorkspaceDecision(
    {
      title: parsed.data.title,
      context: parsed.data.context ?? null,
      decisionText: parsed.data.decisionText,
      priority: parsed.data.priority,
      ownerName: parsed.data.ownerName,
      ownerUserId: parsed.data.ownerUserId ?? null,
      appointmentId: parsed.data.appointmentId ?? null,
      dueAt: parsed.data.dueAt ?? null,
      meetingDate: parsed.data.meetingDate ?? null,
      createdById: session.userId,
    },
    session.userId
  );
  return NextResponse.json({ decision }, { status: 201 });
}
