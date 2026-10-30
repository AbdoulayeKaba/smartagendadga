import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission, userHasPermission } from '@/lib/auth/permission-guard';
import type { ReferentialCategoryId } from '@/lib/dg/referential-catalog';
import { referentialTabPermission } from '@/lib/dg/referential-tab-permissions';
import {
  getReferentialItemById,
  purgeReferentialItem,
  updateReferentialItem,
} from '@/lib/services/referentials-admin';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(191).optional(),
  value: z.string().trim().max(64).optional().nullable(),
  meta: z.unknown().optional(),
  archived: z.boolean().optional(),
  purge: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission('admin.referentials', ['ASSISTANT']);
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const existing = await getReferentialItemById(id);
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  if (parsed.data.purge || parsed.data.archived === false) {
    if (!(await userHasPermission(session!.role, 'action.referentials.trash'))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
  } else {
    const categoryId = existing.categoryId as ReferentialCategoryId;
    const perm = referentialTabPermission(
      categoryId === 'horaires' ? 'horaires' : categoryId
    );
    if (!(await userHasPermission(session!.role, perm))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
  }

  if (parsed.data.purge) {
    const result = await purgeReferentialItem(id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const { purge: _p, ...patch } = parsed.data;
  const result = await updateReferentialItem(id, {
    ...patch,
    value: patch.value === null ? undefined : patch.value,
    meta: patch.meta,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ item: result.item });
}
