import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userCanRequestRoomReservation } from '@/lib/auth/room-reservation-access';
import { assistantBooksUntilStart } from '@/lib/dg/rbac';
import { getDgAvailabilityWeekSummary } from '@/lib/services/dg-availability';
import { getRoomAvailabilityWeekSummary } from '@/lib/services/room-availability';

const querySchema = z.object({
  anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roomId: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userCanRequestRoomReservation(session.role))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    anchor: url.searchParams.get('anchor'),
    roomId: url.searchParams.get('roomId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  if (parsed.data.roomId) {
    const result = await getRoomAvailabilityWeekSummary(parsed.data.anchor, parsed.data.roomId, {
      ignoreReferentialRules: assistantBooksUntilStart(session.role),
    });
    if (!result) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json(result);
  }

  const result = await getDgAvailabilityWeekSummary(parsed.data.anchor);
  return NextResponse.json(result);
}
