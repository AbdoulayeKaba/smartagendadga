import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { previewAdUsers } from '@/lib/services/ad-directory-import';

const ldapSchema = z.object({
  url: z.string().optional(),
  bindDn: z.string().optional(),
  bindPassword: z.string().optional(),
  baseDn: z.string().optional(),
  userFilter: z.string().optional(),
  defaultRole: z.enum(['DG', 'ASSISTANT', 'MANAGER', 'EXTERNAL']).optional(),
  tlsRejectUnauthorized: z.boolean().optional(),
});

const schema = z.object({
  source: z.enum(['graph', 'ldap']),
  ldap: ldapSchema.optional(),
});

export async function POST(req: Request) {
  const auth = await requireApiPermission('admin.users.import');
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const result = await previewAdUsers(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
