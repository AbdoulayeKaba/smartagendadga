import { NextResponse } from 'next/server';
import {
  runAutoMissionStatusTransitions,
  runMissionDailyAlerts,
} from '@/lib/services/mission-workflow';
import { runMailDeadlineAlerts } from '@/lib/services/mail-deadline-alerts';

/** À appeler quotidiennement via cron avec CRON_SECRET */
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const [transitions, alerts, mailAlerts] = await Promise.all([
    runAutoMissionStatusTransitions(),
    runMissionDailyAlerts(),
    runMailDeadlineAlerts(),
  ]);
  return NextResponse.json({ ok: true, ...transitions, alerts, mailAlerts });
}
