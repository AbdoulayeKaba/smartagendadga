import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission, userHasPermission } from '@/lib/auth/permission-guard';
import { deleteUser, updateUser } from '@/lib/services/users-admin';

const patchSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  role: z.string().min(1).max(64).optional(),
  department: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  password: z.string().min(6).max(128).optional(),
  active: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission('admin.users.update');
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const data = parsed.data;
  const keys = Object.keys(data);
  const onlyActive = keys.length === 1 && data.active !== undefined;
  const onlyArchived = keys.length === 1 && data.archived !== undefined;

  let requiredAction: string;
  if (onlyActive) {
    requiredAction = 'action.users.toggle_active';
  } else if (onlyArchived) {
    requiredAction = data.archived
      ? 'action.users.archive'
      : 'action.users.restore';
  } else {
    requiredAction = 'action.users.edit';
  }

  if (!(await userHasPermission(session!.role, requiredAction))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await updateUser(id, data, session!.userId);
  if (!result.ok) {
    const status =
      result.error === 'EMAIL_EXISTS'
        ? 409
        : typeof result.error === 'string' && result.error.startsWith('PASSWORD_')
          ? 422
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    user: result.user,
    sessionRevoked: result.sessionRevoked === true,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiPermission('admin.users.update');
  if (auth.error) return auth.error;
  const { session } = auth;
  if (!(await userHasPermission(session!.role, 'action.users.delete'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await params;
  const result = await deleteUser(id, session!.userId);
  if (!result.ok) {
    const status =
      result.error === 'NOT_FOUND'
        ? 404
        : result.error === 'USER_NOT_ARCHIVED'
          ? 409
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
