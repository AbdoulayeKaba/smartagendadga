import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  completePasswordReset,
  validatePasswordResetToken,
} from '@/lib/auth/password-reset';

const tokenQuerySchema = z.object({
  token: z.string().min(16).max(128),
});

const resetBodySchema = z.object({
  token: z.string().min(16).max(128),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = tokenQuerySchema.safeParse({
    token: url.searchParams.get('token') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const result = await validatePasswordResetToken(parsed.data.token);
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email: result.email });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = resetBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return NextResponse.json(
      { error: 'PASSWORD_MISMATCH', message: 'Les mots de passe ne correspondent pas.' },
      { status: 422 }
    );
  }

  const result = await completePasswordReset({
    token: parsed.data.token,
    newPassword: parsed.data.newPassword,
  });

  if (!result.ok) {
    const message =
      result.error === 'INVALID_TOKEN'
        ? 'Ce lien de réinitialisation est invalide ou expiré.'
        : result.error;
    return NextResponse.json({ error: result.error, message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
