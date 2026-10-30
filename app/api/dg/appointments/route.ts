import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import type { AppointmentStatus, AppointmentType } from '@prisma/client';
import { resolveFromToWithYear } from '@/lib/api/parse-year-filter';
import {
  listAppointmentsForReview,
  type AppointmentUrgencyFilter,
} from '@/lib/services/appointments-review';

export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userHasPermission(session.role, 'appointments.review'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status') as AppointmentStatus | 'ALL' | null;
  const urgency = url.searchParams.get('urgency') as AppointmentUrgencyFilter | null;
  const type = url.searchParams.get('type') as AppointmentType | 'ALL' | null;
  const q = url.searchParams.get('q') ?? undefined;
  const archived = url.searchParams.get('archived') === 'true';
  const isOnlineMeeting = url.searchParams.get('isOnlineMeeting') === 'true';
  const { from, to } = resolveFromToWithYear(url);
  const slotOnly = url.searchParams.get('slotOnly') === '1';

  const result = await listAppointmentsForReview({
    status: status && status !== 'ALL' ? status : 'ALL',
    urgency: urgency === 'NORMAL' || urgency === 'URGENT' ? urgency : 'ALL',
    type: type && type !== 'ALL' ? type : 'ALL',
    q,
    archived,
    ...(isOnlineMeeting ? { isOnlineMeeting: true } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(slotOnly ? { slotOnly: true } : {}),
  });

  return NextResponse.json(result);
}
