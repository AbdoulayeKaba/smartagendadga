import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { parseRoleId } from '@/lib/dg/role-ids';
import {
  createRolePermissionsAdmin,
  getRolesPermissionsAdmin,
} from '@/lib/services/role-permissions-admin';

const createSchema = z.object({
  label: z.string().min(2).max(80),
  description: z.string().max(500),
  copyFrom: z.string().optional(),
});

export async function GET() {
  const auth = await requireApiPermission('admin.roles.permissions', ['ASSISTANT']);
  if (auth.error) return auth.error;

  try {
    const data = await getRolesPermissionsAdmin();
    return NextResponse.json(data);
  } catch (e) {
    console.error('[GET /api/admin/roles]', e);
    return NextResponse.json({ error: 'LOAD_FAILED' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiPermission('admin.roles.manage', ['ASSISTANT']);
  if (auth.error) return auth.error;
  const { session } = auth;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const copyFrom = parsed.data.copyFrom ? parseRoleId(parsed.data.copyFrom) : undefined;
  if (parsed.data.copyFrom && !copyFrom) {
    return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 422 });
  }

  const result = await createRolePermissionsAdmin(
    { label: parsed.data.label, description: parsed.data.description, copyFrom },
    session.userId
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const data = await getRolesPermissionsAdmin();
  return NextResponse.json({ ok: true, roleId: result.roleId, ...data }, { status: 201 });
}
