import { NextResponse } from 'next/server';
import { requireWorkspaceManage, type Ctx } from '@/lib/api/workspace-id-route';
import { updateAudienceSchema } from '@/lib/workspace/schemas';
import { deleteWorkspaceAudience, updateWorkspaceAudience } from '@/lib/services/workspace-service';

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = updateAudienceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }
  const audience = await updateWorkspaceAudience(id, parsed.data, auth.session!.userId);
  if (!audience) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ audience });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const ok = await deleteWorkspaceAudience(id, auth.session!.userId);
  if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
