import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { parseRoleId } from '@/lib/dg/role-ids';
import {
  getRolesPermissionsAdmin,
  updateRolePermissionsAdmin,
} from '@/lib/services/role-permissions-admin';

const patchSchema = z.object({
  permissions: z.record(z.string(), z.boolean()).optional(),
  archived: z.boolean().optional(),
  description: z.string().max(500).optional(),
  label: z.string().min(2).max(80).optional(),
  setAll: z.boolean().optional(),
  sectionId: z.string().optional(),
  purge: z.boolean().optional(),
  copyFrom: z.string().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ roleId: string }> }) {
  const auth = await requireApiPermission('admin.roles.permissions', ['ASSISTANT']);
  if (auth.error) return auth.error;
  const { session } = auth;

  const { roleId: raw } = await ctx.params;
  const role = parseRoleId(raw);
  if (!role) {
    return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const copyFrom = parsed.data.copyFrom ? parseRoleId(parsed.data.copyFrom) : undefined;
  if (parsed.data.copyFrom && !copyFrom) {
    return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 422 });
  }

  const result = await updateRolePermissionsAdmin(
    role,
    { ...parsed.data, copyFrom },
    session.userId
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const data = await getRolesPermissionsAdmin();
  return NextResponse.json({ ok: true, ...data });
}
