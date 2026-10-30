import { NextResponse } from 'next/server';
import { signPortalToken, verifyStudentQrToken } from '@/lib/portal/token';

const usedTokens = new Set<string>();

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const qrToken = typeof json?.qrToken === 'string' ? json.qrToken : null;
  if (!qrToken) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  if (usedTokens.has(qrToken)) return NextResponse.json({ error: 'TOKEN_ALREADY_USED' }, { status: 409 });

  const payload = await verifyStudentQrToken(qrToken);
  if (!payload) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  usedTokens.add(qrToken);
  setTimeout(() => usedTokens.delete(qrToken), 3 * 60 * 1000);

  const token = await signPortalToken({ role: 'student', studentId: payload.studentId });
  return NextResponse.json({ token });
}
