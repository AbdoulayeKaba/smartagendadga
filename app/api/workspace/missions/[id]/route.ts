import { NextResponse } from 'next/server';
import { requireWorkspaceManage, type Ctx } from '@/lib/api/workspace-id-route';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { updateMissionSchema } from '@/lib/workspace/schemas';
import { deleteWorkspaceMission, updateWorkspaceMission } from '@/lib/services/workspace-service';

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = updateMissionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const isArchiveToggle = parsed.data.archived !== undefined;
  if (isArchiveToggle) {
    const perm = parsed.data.archived
      ? 'action.missions.archive'
      : 'action.missions.restore';
    if (!(await userHasPermission(auth.session!.role, perm))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
  } else if (!(await userHasPermission(auth.session!.role, 'action.missions.edit'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await updateWorkspaceMission(
    id,
    {
      ...parsed.data,
      ...(parsed.data.archived !== undefined ? { archived: parsed.data.archived } : {}),
    },
    auth.session!.userId,
    `${auth.session!.firstName} ${auth.session!.lastName}`.trim()
  );
  if (!result.ok) {
    const status = result.error === 'NOT_FOUND' ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ mission: result.mission });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  if (!(await userHasPermission(auth.session!.role, 'action.missions.delete'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const ok = await deleteWorkspaceMission(id, auth.session!.userId);
  if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
