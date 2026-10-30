import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission, userHasPermission } from '@/lib/auth/permission-guard';
import { importUsers } from '@/lib/services/users-admin';

const schema = z.object({
  csv: z.string().min(1),
});

export async function POST(req: Request) {
  const auth = await requireApiPermission('admin.users.import');
  if (auth.error) return auth.error;
  const { session } = auth;
  if (!(await userHasPermission(session!.role, 'action.users.import'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const result = await importUsers(parsed.data.csv, session.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(result);
}
