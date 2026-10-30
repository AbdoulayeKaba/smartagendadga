import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { authenticationOptions, clearExpiredChallenges } from '@/lib/auth/webauthn';

export async function POST(req: Request) {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  await clearExpiredChallenges();
  const options = await authenticationOptions(req, ctx.employeeId);
  return NextResponse.json(options);
}

