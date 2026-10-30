import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createContactSchema } from '@/lib/workspace/schemas';
import {
  countWorkspaceContacts,
  createWorkspaceContact,
  listWorkspaceContacts,
} from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  const archived = url.searchParams.get('archived') === 'true';
  try {
    const [items, counts] = await Promise.all([
      listWorkspaceContacts({
        category: url.searchParams.get('category') ?? undefined,
        q: url.searchParams.get('q') ?? undefined,
        archived,
      }),
      countWorkspaceContacts(),
    ]);
    return NextResponse.json({ items, counts });
  } catch (e) {
    console.error('[GET /api/workspace/contacts]', e);
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!(await userHasPermission(session.role, 'action.contacts.create'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = createContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const contact = await createWorkspaceContact(
    {
      category: parsed.data.category,
      fullName: parsed.data.fullName,
      jobTitle: parsed.data.jobTitle ?? null,
      organization: parsed.data.organization,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email || null,
      notes: parsed.data.notes ?? null,
    },
    session.userId
  );
  return NextResponse.json({ contact }, { status: 201 });
}
