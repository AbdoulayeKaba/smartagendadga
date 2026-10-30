import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createAudienceSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { createWorkspaceAudience, listWorkspaceAudiences } from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  const items = await listWorkspaceAudiences({
    q: url.searchParams.get('q') ?? undefined,
    archived: url.searchParams.get('archived') === 'true' ? true : undefined,
    year: parseYearFromRequest(url),
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = createAudienceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const record = await createWorkspaceAudience(
    {
      heldAt: parsed.data.heldAt,
      endAt: parsed.data.endAt ?? null,
      participants: parsed.data.participants,
      subject: parsed.data.subject,
      outcome: parsed.data.outcome ?? null,
      minutes: parsed.data.minutes ?? null,
      appointmentId: parsed.data.appointmentId ?? null,
    },
    session.userId
  );
  return NextResponse.json({ record }, { status: 201 });
}
