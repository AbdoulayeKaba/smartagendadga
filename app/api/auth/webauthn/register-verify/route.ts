import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { verifyRegistration } from '@/lib/auth/webauthn';
import { logAuditFromRequest } from '@/lib/audit/write-audit';

const bodySchema = z.object({
  response: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const out = await verifyRegistration(req, ctx.employeeId, parsed.data.response);
    if (!out.verified) return NextResponse.json({ error: 'REGISTER_FAILED' }, { status: 400 });
    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'biometric.register',
        entity: 'webauthn_credential',
      });
    } catch {
      /* ignore */
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'REGISTER_FAILED' }, { status: 400 });
  }
}

