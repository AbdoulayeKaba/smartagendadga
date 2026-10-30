import { NextResponse } from 'next/server';
import { getServerSessionContext } from '@/lib/auth/session-server';
import { signEmployeePunchQrToken } from '@/lib/attendance/qr-kiosk';

/** Token court pour affichage QR « Mon badge » (employé connecté uniquement). */
export async function GET() {
  const ctx = await getServerSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const token = await signEmployeePunchQrToken(ctx.employeeId);
  return NextResponse.json({ token, expiresInSeconds: 90 });
}
