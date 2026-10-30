import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import {
  userCanRequestRoomReservation,
  userCanReviewRoomReservations,
} from '@/lib/auth/room-reservation-access';
import { assistantBooksUntilStart } from '@/lib/dg/rbac';
import {
  archiveRoomReservation,
  deleteRoomReservationPermanent,
  restoreRoomReservation,
  updateRoomReservation,
  updateRoomReservationSchema,
} from '@/lib/services/room-reservations';

const archivePatchSchema = z.object({
  archived: z.boolean(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, error } = await requireApiSession();
    if (error) return error;

    const { id } = await params;
    const json = await req.json().catch(() => null);

    if (json && typeof json === 'object' && 'archived' in json && json.title === undefined) {
      if (!(await userCanReviewRoomReservations(session.role))) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }

      const parsed = archivePatchSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
      }

      const perm = parsed.data.archived
        ? 'action.room_reservations.archive'
        : 'action.room_reservations.restore';
      if (!(await userHasPermission(session.role, perm))) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }

      const result = parsed.data.archived
        ? await archiveRoomReservation(id, session.userId)
        : await restoreRoomReservation(id, session.userId);

      if (!result.ok) {
        const status =
          result.error === 'NOT_FOUND'
            ? 404
            : result.error === 'ALREADY_ARCHIVED' || result.error === 'NOT_ARCHIVED'
              ? 409
              : 400;
        return NextResponse.json({ error: result.error }, { status });
      }

      return NextResponse.json({ ok: true });
    }

    const canReview = await userCanReviewRoomReservations(session.role);
    const canRequest = await userCanRequestRoomReservation(session.role);
    if (!canReview && !canRequest) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    if (!(await userHasPermission(session.role, 'action.room_reservations.edit'))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const parsed = updateRoomReservationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
    }

    const excludeAppointmentId =
      json &&
      typeof json === 'object' &&
      typeof (json as { excludeAppointmentId?: unknown }).excludeAppointmentId === 'string'
        ? (json as { excludeAppointmentId: string }).excludeAppointmentId.trim() || undefined
        : undefined;

    const result = await updateRoomReservation(id, parsed.data, session.userId, {
      asReviewer: canReview,
      excludeAppointmentId,
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
          : result.error === 'FORBIDDEN'
            ? 403
            : result.error === 'NOT_EDITABLE'
              ? 409
              : 422;
      return NextResponse.json({ error: result.error, message: 'message' in result ? result.message : undefined }, { status });
    }

    return NextResponse.json({ ok: true, reservation: result.reservation, pending: result.pending ?? false });
  } catch (err) {
    console.error('[PATCH /api/dg/room-reservations/[id]]', err);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (!(await userCanReviewRoomReservations(session.role))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!(await userHasPermission(session.role, 'action.room_reservations.delete'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await params;
  const result = await deleteRoomReservationPermanent(id, session.userId);
  if (!result.ok) {
    const status =
      result.error === 'NOT_FOUND'
        ? 404
        : result.error === 'NOT_ARCHIVED'
          ? 409
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
