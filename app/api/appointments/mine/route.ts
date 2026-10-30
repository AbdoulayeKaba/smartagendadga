import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import type { AppointmentStatus, AppointmentType } from '@prisma/client';
import { resolveFromToWithYear } from '@/lib/api/parse-year-filter';
import { listAppointmentsForAudience } from '@/lib/services/appointments';
import {
  listAppointmentsForReview,
  type AppointmentUrgencyFilter,
} from '@/lib/services/appointments-review';

/**
 * Demandes de l’utilisateur connecté uniquement (`requestedById`).
 * Accessible à toute session authentifiée — pas de fuite cross-user.
 */
export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') as AppointmentStatus | 'ALL' | null;
  const urgency = url.searchParams.get('urgency') as AppointmentUrgencyFilter | null;
  const type = url.searchParams.get('type') as AppointmentType | 'ALL' | null;
  const q = url.searchParams.get('q') ?? undefined;
  const archived = url.searchParams.get('archived') === 'true';
  const isOnlineMeeting = url.searchParams.get('isOnlineMeeting') === 'true';
  const { from, to } = resolveFromToWithYear(url);
  const slotOnly = url.searchParams.get('slotOnly') === '1';
  const involved = url.searchParams.get('involved') === '1';

  try {
    if (involved) {
      const rows = await listAppointmentsForAudience({
        userId: session.userId,
        email: session.email,
        status: status && status !== 'ALL' ? status : undefined,
        archived,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      return NextResponse.json({
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          startAt: row.startAt.toISOString(),
          endAt: row.endAt.toISOString(),
          status: row.status,
        })),
      });
    }

    const result = await listAppointmentsForReview({
      status: status && status !== 'ALL' ? status : 'ALL',
      urgency: urgency === 'NORMAL' || urgency === 'URGENT' ? urgency : 'ALL',
      type: type && type !== 'ALL' ? type : 'ALL',
      q,
      archived,
      requestedById: session.userId,
      ...(isOnlineMeeting ? { isOnlineMeeting: true } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(slotOnly ? { slotOnly: true } : {}),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/appointments/mine]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
