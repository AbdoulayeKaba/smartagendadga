import { NextResponse } from 'next/server';
import { autoRejectExpiredPendingAppointments } from '@/lib/services/appointment-auto-reject';

/** À appeler périodiquement via cron avec CRON_SECRET */
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await autoRejectExpiredPendingAppointments({ force: true });
  return NextResponse.json({ ok: true, ...result });
}
