import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { clearExpiredChallenges, registrationOptions } from '@/lib/auth/webauthn';

const bodySchema = z.object({
  userName: z.string().trim().min(2).max(191).optional(),
});

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  await clearExpiredChallenges();
  const options = await registrationOptions(
    req,
    ctx.employeeId,
    parsed.data.userName || `${ctx.user.firstName} ${ctx.user.lastName}`.trim() || ctx.user.email
  );
  return NextResponse.json(options);
}

