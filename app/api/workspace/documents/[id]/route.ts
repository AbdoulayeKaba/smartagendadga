import { NextResponse } from 'next/server';
import { requireWorkspaceManage, type Ctx } from '@/lib/api/workspace-id-route';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { updateReportSchema } from '@/lib/workspace/schemas';
import { deleteWorkspaceDocument, updateWorkspaceDocument } from '@/lib/services/workspace-service';
import { ReportDuplicateError } from '@/lib/workspace/report-errors';

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = updateReportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const isArchiveToggle = parsed.data.archived !== undefined;
  if (isArchiveToggle) {
    const perm = parsed.data.archived
      ? 'action.documents.archive'
      : 'action.documents.restore';
    if (!(await userHasPermission(auth.session!.role, perm))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
  } else if (!(await userHasPermission(auth.session!.role, 'action.documents.edit'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const document = await updateWorkspaceDocument(id, parsed.data, auth.session!.userId);
    if (!document) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ document });
  } catch (err) {
    if (err instanceof ReportDuplicateError) {
      return NextResponse.json({ error: err.code }, { status: 409 });
    }
    console.error('[PATCH /api/workspace/documents/:id]', err);
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  if (!(await userHasPermission(auth.session!.role, 'action.documents.delete'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const ok = await deleteWorkspaceDocument(id, auth.session!.userId);
  if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
