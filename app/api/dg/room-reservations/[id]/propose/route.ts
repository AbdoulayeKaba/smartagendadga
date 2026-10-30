import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { userCanReviewRoomReservations } from '@/lib/auth/room-reservation-access';
import { assistantBooksUntilStart } from '@/lib/dg/rbac';
import {
  proposeRoomReservationSlot,
  proposeRoomReservationSlotSchema,
} from '@/lib/services/room-reservations';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireApiSession();
    if (error) return error;
    if (!(await userCanReviewRoomReservations(session.role))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    if (!(await userHasPermission(session.role, 'action.room_reservations.propose'))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = await params;
    const json = await req.json().catch(() => null);
    const parsed = proposeRoomReservationSlotSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await proposeRoomReservationSlot(id, session.userId, parsed.data, {
      ignoreReferentialRules: assistantBooksUntilStart(session.role),
    });
    if (!result.ok) {
      if (result.error === 'ROOM_CONFLICT') {
        return NextResponse.json(
          { error: result.error, message: result.message, conflict: 'conflict' in result ? result.conflict : undefined },
          { status: 409 }
        );
      }
      const status =
        result.error === 'NOT_FOUND'
          ? 404
          : result.error === 'INVALID_RANGE' || result.error === 'DURATION_NOT_ALLOWED'
            ? 422
            : 400;
      return NextResponse.json({ error: result.error, message: 'message' in result ? result.message : undefined }, { status });
    }

    return NextResponse.json({ ok: true, pending: true, reservation: result.reservation });
  } catch (err) {
    console.error('[POST /api/dg/room-reservations/[id]/propose]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
