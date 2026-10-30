import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission, userHasPermission } from '@/lib/auth/permission-guard';
import { importAdUsers } from '@/lib/services/ad-directory-import';

const userSchema = z.object({
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  department: z.string(),
  role: z.enum(['DG', 'ASSISTANT', 'MANAGER', 'EXTERNAL']),
  externalId: z.string(),
  alreadyExists: z.boolean().optional(),
});

const schema = z.object({
  emails: z.array(z.string().email()).min(1),
  users: z.array(userSchema).min(1),
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

  const result = await importAdUsers(parsed.data.emails, parsed.data.users, session.userId);
  return NextResponse.json(result);
}
