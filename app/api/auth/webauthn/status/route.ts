import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { biometricStatus, listBiometricCredentials } from '@/lib/auth/webauthn';

export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const status = await biometricStatus(ctx.employeeId);
  const credentials = await listBiometricCredentials(ctx.employeeId);
  return NextResponse.json({ ...status, credentials });
}

