import { NextResponse } from 'next/server';
import { requireWorkspaceManage, type Ctx } from '@/lib/api/workspace-id-route';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { updateContactSchema } from '@/lib/workspace/schemas';
import { deleteWorkspaceContact, updateWorkspaceContact } from '@/lib/services/workspace-service';

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const parsed = updateContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const isArchiveToggle = parsed.data.archived !== undefined;
  if (isArchiveToggle) {
    const perm = parsed.data.archived
      ? 'action.contacts.archive'
      : 'action.contacts.restore';
    if (!(await userHasPermission(auth.session!.role, perm))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
  } else if (!(await userHasPermission(auth.session!.role, 'action.contacts.edit'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const patch = {
    ...parsed.data,
    ...(parsed.data.email === '' ? { email: null } : {}),
    ...(parsed.data.archived !== undefined
      ? { archived: parsed.data.archived }
      : {}),
  };
  const contact = await updateWorkspaceContact(id, patch, auth.session!.userId);
  if (!contact) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ contact });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  if (!(await userHasPermission(auth.session!.role, 'action.contacts.delete'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const ok = await deleteWorkspaceContact(id, auth.session!.userId);
  if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
