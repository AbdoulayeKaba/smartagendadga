import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { getAccountProfile, updateAccountProfile } from '@/lib/services/account-profile';

const patchSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().default(''),
  department: z.string().trim().max(120).optional().default(''),
  password: z.string().min(1).max(128).optional(),
  passwordConfirm: z.string().min(1).max(128).optional(),
});

export async function GET() {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const profile = await getAccountProfile(session.userId);
  if (!profile) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ user: profile });
}

export async function PATCH(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const { password, passwordConfirm, ...identity } = parsed.data;
  if (password || passwordConfirm) {
    if (!password || password !== passwordConfirm) {
      return NextResponse.json({ error: 'PASSWORD_MISMATCH' }, { status: 422 });
    }
  }

  const result = await updateAccountProfile(session.userId, {
    ...identity,
    ...(password ? { password } : {}),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === 'NOT_FOUND' ? 404 : 422 }
    );
  }

  return NextResponse.json({
    user: result.profile,
    sessionRevoked: result.sessionRevoked,
  });
}
