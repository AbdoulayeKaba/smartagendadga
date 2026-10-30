import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import {
  cancelAccountTwoFactorSetup,
  confirmAccountTwoFactor,
  disableAccountTwoFactor,
  getAccountTwoFactorStatus,
  startAccountTwoFactorSetup,
} from '@/lib/services/account-two-factor';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('setup') }),
  z.object({
    action: z.literal('confirm'),
    code: z.string().trim().min(6).max(8),
  }),
  z.object({
    action: z.literal('disable'),
    code: z.string().trim().min(6).max(8).optional(),
    password: z.string().min(1).max(128).optional(),
  }),
  z.object({ action: z.literal('cancel-setup') }),
]);

export async function GET() {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const status = await getAccountTwoFactorStatus(session.userId);
  if (!status) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  if (parsed.data.action === 'setup') {
    const result = await startAccountTwoFactorSetup(session.userId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'NOT_FOUND' ? 404 : 409 }
      );
    }
    return NextResponse.json({
      ok: true,
      secret: result.secret,
      otpauthUrl: result.otpauthUrl,
      qrDataUrl: result.qrDataUrl,
    });
  }

  if (parsed.data.action === 'confirm') {
    const result = await confirmAccountTwoFactor(session.userId, parsed.data.code);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'INVALID_CODE' ? 422 : 400 }
      );
    }
    return NextResponse.json({ ok: true, enabled: true });
  }

  if (parsed.data.action === 'cancel-setup') {
    const result = await cancelAccountTwoFactorSetup(session.userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true, enabled: false });
  }

  const { code, password } = parsed.data;
  if (!code && !password) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }
  const result = await disableAccountTwoFactor(session.userId, { code, password });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === 'INVALID_CREDENTIALS' ? 403 : 404 }
    );
  }
  return NextResponse.json({ ok: true, enabled: false });
}
