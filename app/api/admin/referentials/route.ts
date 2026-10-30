import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission, userHasPermission } from '@/lib/auth/permission-guard';
import type { ReferentialCategoryId } from '@/lib/dg/referential-catalog';
import { referentialTabPermission } from '@/lib/dg/referential-tab-permissions';
import {
  createReferentialItem,
  emptyReferentialsTrash,
  getReferentialsOverview,
  listAllTrashItems,
  listReferentialItems,
} from '@/lib/services/referentials-admin';

const categorySchema = z.enum([
  'jours-feries',
  'indisponibilites',
  'types-rdv',
  'lieux',
  'motifs',
  'departements',
]);

const postSchema = z.object({
  categoryId: categorySchema,
  name: z.string().trim().min(1).max(191),
  value: z.string().trim().max(64).optional(),
  meta: z.unknown().optional(),
});

export async function GET(req: Request) {
  const auth = await requireApiPermission('admin.referentials', ['ASSISTANT']);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const category = url.searchParams.get('category') as ReferentialCategoryId | null;
  const archived = url.searchParams.get('archived') === 'true';
  const allTrash = url.searchParams.get('trash') === 'true';
  const search = url.searchParams.get('search') ?? undefined;

  if (allTrash) {
    if (!(await userHasPermission(auth.session!.role, 'action.referentials.trash'))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const items = await listAllTrashItems(search);
    return NextResponse.json({ items });
  }

  if (category && category !== 'horaires') {
    const parsed = categorySchema.safeParse(category);
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_CATEGORY' }, { status: 400 });
    }
    const perm = referentialTabPermission(parsed.data);
    if (!(await userHasPermission(auth.session!.role, perm))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const items = await listReferentialItems(parsed.data, { archived, search });
    return NextResponse.json({ items });
  }

  const overview = await getReferentialsOverview();
  return NextResponse.json(overview);
}

export async function POST(req: Request) {
  const auth = await requireApiPermission('admin.referentials', ['ASSISTANT']);
  if (auth.error) return auth.error;
  const { session } = auth;

  const url = new URL(req.url);
  if (url.searchParams.get('action') === 'empty-trash') {
    if (!(await userHasPermission(session!.role, 'action.referentials.trash'))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const result = await emptyReferentialsTrash();
    return NextResponse.json(result);
  }

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const perm = referentialTabPermission(parsed.data.categoryId);
  if (!(await userHasPermission(session!.role, perm))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await createReferentialItem(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ item: result.item }, { status: 201 });
}
