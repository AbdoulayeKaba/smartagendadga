import { NextResponse } from 'next/server';
import { z } from 'zod';
import { homePathForRoleId } from '@/lib/auth/post-login-redirect';
import {
  CREDENTIALS_LOGIN_ERROR_LABELS,
  verifyCredentialsLogin,
} from '@/lib/auth/credentials-login';
const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().trim().min(6).max(8).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  try {
    const result = await verifyCredentialsLogin(
      parsed.data.email,
      parsed.data.password,
      parsed.data.totpCode
    );
    if (!result.ok) {
      if (result.error === 'TWO_FACTOR_PENDING') {
        return NextResponse.json({
          ok: false,
          requiresMfa: true,
          error: result.error,
          message: CREDENTIALS_LOGIN_ERROR_LABELS[result.error],
        });
      }
      return NextResponse.json({
        ok: false,
        error: result.error,
        message: CREDENTIALS_LOGIN_ERROR_LABELS[result.error],
      });
    }

    return NextResponse.json({
      ok: true,
      role: result.user.role,
      redirectTo: result.user.mustChangePassword
        ? '/change-password'
        : await homePathForRoleId(result.user.role),
    });
  } catch (e) {
    console.error('[POST /api/auth/credentials-check]', e);
    return NextResponse.json(
      {
        ok: false,
        error: 'DB_UNAVAILABLE',
        message:
          'Base de données inaccessible. Vérifiez que MySQL est démarré (localhost:3306).',
      },
      { status: 503 }
    );
  }
}
