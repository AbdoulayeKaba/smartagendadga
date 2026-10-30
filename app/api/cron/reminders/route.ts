import { NextResponse } from 'next/server';
import { enqueueMeetingLifecycleNotifications } from '@/lib/services/appointment-participant-notifications';
import { processDueAppointmentReminders } from '@/lib/services/appointment-reminder-dispatch';

/** À appeler via cron (ex. toutes les 15 min) avec CRON_SECRET */
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  await enqueueMeetingLifecycleNotifications();
  const result = await processDueAppointmentReminders();
  return NextResponse.json(result);
}
