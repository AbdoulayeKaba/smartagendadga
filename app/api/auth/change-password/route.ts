import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { completeUserPasswordChange } from '@/lib/auth/change-password';
import { passwordPolicyErrorMessage } from '@/lib/auth/password-policy';

const bodySchema = z.object({
  newPassword: z.string().min(1),
  confirmPassword: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return NextResponse.json(
      { error: 'PASSWORD_MISMATCH', message: 'Les mots de passe ne correspondent pas.' },
      { status: 422 }
    );
  }

  const result = await completeUserPasswordChange({
    userId: session.user.id,
    newPassword: parsed.data.newPassword,
    requireCurrentPassword: false,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: passwordPolicyErrorMessage(result.error),
      },
      { status: result.error === 'NOT_FOUND' ? 404 : 422 }
    );
  }

  return NextResponse.json({ ok: true });
}
