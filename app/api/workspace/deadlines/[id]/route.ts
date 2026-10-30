import { NextResponse } from 'next/server';
import { requireWorkspaceManage, type Ctx } from '@/lib/api/workspace-id-route';
import { updateDeadlineSchema } from '@/lib/workspace/schemas';
import { deleteWorkspaceDeadline, updateWorkspaceDeadline } from '@/lib/services/workspace-service';

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = updateDeadlineSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }
  const deadline = await updateWorkspaceDeadline(id, parsed.data, auth.session!.userId);
  if (!deadline) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ deadline });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const ok = await deleteWorkspaceDeadline(id, auth.session!.userId);
  if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
