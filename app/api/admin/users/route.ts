import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission, userHasPermission } from '@/lib/auth/permission-guard';
import { createUser, listUsers } from '@/lib/services/users-admin';

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  role: z.string().min(1).max(64),
  department: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  password: z.string().min(6).max(128).optional(),
  sendWelcomeEmail: z.boolean().optional(),
});

export async function GET() {
  try {
    const auth = await requireApiPermission('admin.users.read');
    if (auth.error) return auth.error;

    const items = await listUsers();
    return NextResponse.json({ items });
  } catch (e) {
    console.error('[GET /api/admin/users]', e);
    return NextResponse.json({ error: 'LOAD_FAILED' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiPermission('admin.users.create');
  if (auth.error) return auth.error;
  const { session } = auth;
  if (!(await userHasPermission(session!.role, 'action.users.create'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  try {
    const result = await createUser(parsed.data, session!.userId);
    if (!result.ok) {
      const status =
        result.error === 'EMAIL_EXISTS'
          ? 409
          : result.error === 'INVALID_ROLE'
            ? 422
            : result.error.startsWith('PASSWORD_')
              ? 422
              : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(
      {
        user: result.user,
        welcomeEmail: result.welcomeEmail,
        restoredFromTrash: 'restoredFromTrash' in result ? result.restoredFromTrash : false,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error('[POST /api/admin/users]', e);
    return NextResponse.json({ error: 'CREATE_FAILED' }, { status: 500 });
  }
}
