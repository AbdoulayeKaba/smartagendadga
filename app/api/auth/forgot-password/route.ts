import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/lib/auth/password-reset';

const bodySchema = z.object({
  email: z.string().email().max(191),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
    }

    await requestPasswordReset(parsed.data.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/auth/forgot-password]', err);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Impossible d’envoyer l’e-mail pour le moment.' },
      { status: 500 }
    );
  }
}
