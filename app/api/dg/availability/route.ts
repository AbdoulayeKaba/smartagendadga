import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userCanRequestRoomReservation } from '@/lib/auth/room-reservation-access';
import { assistantBooksUntilStart } from '@/lib/dg/rbac';
import { getDgAvailability } from '@/lib/services/dg-availability';
import { getRoomAvailability } from '@/lib/services/room-availability';

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roomId: z.string().min(1).optional(),
  excludeReservationId: z.string().min(1).optional(),
  excludeAppointmentId: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userCanRequestRoomReservation(session.role))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    date: url.searchParams.get('date'),
    roomId: url.searchParams.get('roomId') ?? undefined,
    excludeReservationId: url.searchParams.get('excludeReservationId') ?? undefined,
    excludeAppointmentId: url.searchParams.get('excludeAppointmentId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  if (parsed.data.roomId) {
    const result = await getRoomAvailability(parsed.data.date, parsed.data.roomId, {
      excludeReservationId: parsed.data.excludeReservationId,
      excludeAppointmentId: parsed.data.excludeAppointmentId,
      ignoreReferentialRules: assistantBooksUntilStart(session.role),
    });
    if (!result) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json(result);
  }

  const result = await getDgAvailability(parsed.data.date);
  return NextResponse.json(result);
}
