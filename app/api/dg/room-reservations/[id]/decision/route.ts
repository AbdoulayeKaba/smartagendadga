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
  approveRoomReservation,
  cancelRoomReservation,
  rejectRoomReservation,
} from '@/lib/services/room-reservations';

const schema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'CANCEL']),
    reason: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'REJECT') {
      const reason = data.reason?.trim() ?? '';
      if (reason.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Le motif du refus est obligatoire (3 caractères minimum).',
          path: ['reason'],
        });
      }
    }
  });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const canReview = await userCanReviewRoomReservations(session.role);
  const canRequest = await userCanRequestRoomReservation(session.role);
  if (!canReview && !canRequest) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  if (parsed.data.action === 'CANCEL') {
    // Annulation réservée à la revue — le demandeur ne peut pas annuler depuis Mes réservations.
    if (!canReview) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    if (!(await userHasPermission(session.role, 'action.room_reservations.cancel'))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const result = await cancelRoomReservation(id, session.userId, { asReviewer: true });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          message: 'message' in result ? result.message : undefined,
        },
        { status: result.error === 'FORBIDDEN' ? 403 : 404 }
      );
    }
    return NextResponse.json({ ok: true, reservation: result.reservation });
  }

  if (!canReview) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  if (parsed.data.action === 'REJECT') {
    if (!(await userHasPermission(session.role, 'action.room_reservations.reject'))) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const result = await rejectRoomReservation(id, session.userId, parsed.data.reason ?? undefined);
    if (!result.ok) {
      const status =
        result.error === 'REASON_REQUIRED'
          ? 422
          : result.error === 'ROOM_CONFLICT'
            ? 409
            : 404;
      return NextResponse.json(
        { error: result.error, message: 'message' in result ? result.message : undefined },
        { status }
      );
    }
    return NextResponse.json({ ok: true, reservation: result.reservation });
  }

  if (!(await userHasPermission(session.role, 'action.room_reservations.approve'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const result = await approveRoomReservation(id, session.userId, {
    ignoreReferentialRules: assistantBooksUntilStart(session.role),
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        message: 'message' in result ? result.message : undefined,
        conflict: 'conflict' in result ? result.conflict : undefined,
      },
      { status: result.error === 'ROOM_CONFLICT' ? 409 : 404 }
    );
  }

  return NextResponse.json({ ok: true, reservation: result.reservation });
}
