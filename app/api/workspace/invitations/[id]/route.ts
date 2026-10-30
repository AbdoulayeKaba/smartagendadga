import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { updateInvitationFullSchema } from '@/lib/workspace/schemas';
import { deleteWorkspaceInvitation, updateWorkspaceInvitation } from '@/lib/services/workspace-service';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const parsed = updateInvitationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const invitation = await updateWorkspaceInvitation(id, parsed.data, session.userId);
  if (!invitation) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ invitation });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const ok = await deleteWorkspaceInvitation(id, session.userId);
  if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
