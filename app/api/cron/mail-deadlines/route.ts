import { NextResponse } from 'next/server';
import { runMailDeadlineAlerts } from '@/lib/services/mail-deadline-alerts';

/** À appeler quotidiennement via cron avec CRON_SECRET (x-cron-secret). */
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const alerts = await runMailDeadlineAlerts();
  return NextResponse.json({ ok: true, alerts });
}
