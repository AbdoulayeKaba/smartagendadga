import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { autoRejectExpiredPendingAppointments } from '@/lib/services/appointment-auto-reject';
import { getDgCockpit } from '@/lib/services/dg-cockpit';

export async function GET() {
  const { session, error } = await requireApiSession(['DG', 'ASSISTANT']);
  if (error) return error;
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const now = new Date();
  await autoRejectExpiredPendingAppointments({ now });

  const cockpit = await getDgCockpit(
    {
      firstName: session.firstName,
      lastName: session.lastName,
      role: session.role,
    },
    now
  );

  return NextResponse.json({ cockpit });
}
