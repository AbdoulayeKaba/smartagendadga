import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { verifyAuthentication } from '@/lib/auth/webauthn';
import { BIOMETRIC_PROOF_COOKIE, issueBiometricProof } from '@/lib/auth/biometric-proof';
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
    const out = await verifyAuthentication(req, ctx.employeeId, parsed.data.response);
    if (!out.verified) return NextResponse.json({ error: 'AUTHENTICATION_FAILED' }, { status: 400 });

    const proof = await issueBiometricProof(ctx.employeeId);
    const res = NextResponse.json({ ok: true, verified: true });
    res.cookies.set(BIOMETRIC_PROOF_COOKIE, proof, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 120,
    });

    try {
      await logAuditFromRequest(req, { employeeId: ctx.employeeId, user: ctx.user }, {
        action: 'biometric.verify',
        entity: 'webauthn_credential',
      });
    } catch {
      /* ignore */
    }

    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AUTHENTICATION_FAILED' }, { status: 400 });
  }
}

