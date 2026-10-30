import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createInvitationSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import { createWorkspaceInvitation, listWorkspaceInvitations } from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  const items = await listWorkspaceInvitations({ year: parseYearFromRequest(url) });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = createInvitationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const invitation = await createWorkspaceInvitation(
    {
      organizer: parsed.data.organizer,
      eventTitle: parsed.data.eventTitle,
      eventDate: parsed.data.eventDate,
      location: parsed.data.location ?? null,
      importance: parsed.data.importance,
      notes: parsed.data.notes ?? null,
    },
    session.userId
  );
  return NextResponse.json({ invitation }, { status: 201 });
}
