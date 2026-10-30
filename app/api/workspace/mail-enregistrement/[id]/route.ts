import { NextResponse } from 'next/server';
import { requireWorkspaceManage, type Ctx } from '@/lib/api/workspace-id-route';
import { updateMailSchema } from '@/lib/workspace/schemas';
import {
  deleteWorkspaceMail,
  getWorkspaceMail,
  updateWorkspaceMail,
} from '@/lib/services/workspace-service';

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const existing = await getWorkspaceMail(id);
  if (!existing || existing.mailKind !== 'VAULT') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  const parsed = updateMailSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }
  const data = parsed.data;
  if (
    data.archived === undefined &&
    data.attachments !== undefined &&
    data.attachments.length === 0
  ) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', field: 'attachments' }, { status: 422 });
  }
  const mail = await updateWorkspaceMail(
    id,
    { ...data, mailKind: 'VAULT' },
    auth.session!.userId
  );
  if (!mail) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ mail });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const existing = await getWorkspaceMail(id);
  if (!existing || existing.mailKind !== 'VAULT') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  const ok = await deleteWorkspaceMail(id, auth.session!.userId);
  if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
