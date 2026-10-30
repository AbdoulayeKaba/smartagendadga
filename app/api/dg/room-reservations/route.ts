import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import {
  userCanCreateRoomReservation,
  userCanRequestRoomReservation,
  userCanReviewRoomReservations,
} from '@/lib/auth/room-reservation-access';
import { parseAppointmentMeta } from '@/lib/dg/appointment-request-meta';
import { assistantBooksUntilStart } from '@/lib/dg/rbac';
import { prisma } from '@/lib/prisma';
import { isMockDataEnabled } from '@/lib/mock/config';
import {
  countArchivedRoomReservations,
  createRoomReservation,
  createRoomReservationSchema,
  listRoomReservations,
} from '@/lib/services/room-reservations';
import { autoExpireRoomReservations } from '@/lib/services/room-reservation-auto-expire';
import type { RoomReservationStatus } from '@/lib/mock/room-reservations-store';

const statusSchema = z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED']);

async function appointmentLinksByReservationId(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (isMockDataEnabled()) return map;
  const rows = await prisma.appointment.findMany({
    where: { description: { contains: 'roomReservationId' } },
    select: { id: true, description: true },
    take: 2000,
  });
  for (const row of rows) {
    const { meta } = parseAppointmentMeta(row.description);
    const reservationId = meta.roomReservationId?.trim();
    if (reservationId) map.set(reservationId, row.id);
  }
  return map;
}

function serializeRow(row: Awaited<ReturnType<typeof listRoomReservations>>[number]) {
  const bookedByName = row.bookedBy
    ? `${row.bookedBy.firstName} ${row.bookedBy.lastName}`.trim()
    : 'Utilisateur';
  const bookingOrigin =
    row.bookingOrigin === 'APPOINTMENT' || row.bookingOrigin === 'SLOT'
      ? row.bookingOrigin
      : /rendez[\s-]?vous/i.test(row.organizerService)
        ? ('APPOINTMENT' as const)
        : ('SLOT' as const);
  return {
    ...row,
    source: 'reservation' as const,
    bookingOrigin,
    appointmentId: row.appointmentId ?? undefined,
    equipment: row.equipment,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    archived: row.archived,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assistantNote: row.assistantNote ?? null,
    bookedByName,
    bookedByEmail: row.bookedBy?.email ?? '',
    bookedByPhone: row.bookedBy?.phone ?? '',
    bookedBy: row.bookedBy
      ? {
          id: row.bookedBy.id,
          name: bookedByName,
          email: row.bookedBy.email,
          phone: row.bookedBy.phone ?? '',
        }
      : undefined,
  };
}

export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const canReview = await userCanReviewRoomReservations(session.role);
  const canRequest = await userCanRequestRoomReservation(session.role);
  if (!canReview && !canRequest) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const mineOnly =
    url.searchParams.get('mine') === '1' || url.searchParams.get('scope') === 'own';
  const roomId = url.searchParams.get('roomId') ?? undefined;
  const date = url.searchParams.get('date');
  const statusParam = url.searchParams.get('status');
  const archivedParam = url.searchParams.get('archived');
  const archived = archivedParam === 'true';
  let from: Date | undefined;
  let to: Date | undefined;
  if (date) {
    from = new Date(`${date}T00:00:00`);
    to = new Date(`${date}T23:59:59`);
  }

  let status: RoomReservationStatus | RoomReservationStatus[] | undefined;
  if (statusParam) {
    // Filtre statut : revue globale OU vue « mes réservations » (données déjà scopées).
    if (!canReview && !mineOnly) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    if (statusParam === 'ALL') {
      status = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'];
    } else {
      const parsed = statusSchema.safeParse(statusParam);
      if (!parsed.success) {
        return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
      }
      // COMPLETED est un statut d’affichage dérivé (confirmée + créneau passé), pas en base.
      status = parsed.data === 'COMPLETED' ? 'CONFIRMED' : parsed.data;
    }
  } else if (mineOnly) {
    status = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'];
  } else if (canReview && url.searchParams.get('pending') === '1') {
    status = 'PENDING';
  } else {
    status = 'CONFIRMED';
  }

  await autoExpireRoomReservations();

  const items = await listRoomReservations({
    from,
    to,
    roomId,
    status,
    bookedById: mineOnly || !canReview ? session.userId : undefined,
    includeBookedBy: true,
    archived: mineOnly ? false : archived,
  });

  // Liste / Mes réservations = uniquement les RoomReservation (pas les créneaux agenda).
  // L’occupation des audiences DGA reste visible sur « Créneaux salles ».
  const links = await appointmentLinksByReservationId();
  const reservationRows = items.map((row) => {
    const serialized = serializeRow(row);
    const linkedAppointmentId = serialized.appointmentId || links.get(row.id);
    if (!linkedAppointmentId) return serialized;
    return {
      ...serialized,
      bookingOrigin: 'APPOINTMENT' as const,
      appointmentId: linkedAppointmentId,
    };
  });
  const trashCount = canReview && !mineOnly ? await countArchivedRoomReservations() : 0;

  return NextResponse.json({
    items: reservationRows,
    stats: { trash: trashCount },
  });
}

export async function POST(req: Request) {
  try {
    const { session, error } = await requireApiSession();
    if (error) return error;
    if (!userCanCreateRoomReservation(session.role)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const json = await req.json().catch(() => null);
    const parsed = createRoomReservationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 422 });
    }

    const excludeAppointmentId =
      json &&
      typeof json === 'object' &&
      typeof (json as { excludeAppointmentId?: unknown }).excludeAppointmentId === 'string'
        ? (json as { excludeAppointmentId: string }).excludeAppointmentId.trim() || undefined
        : undefined;

    const result = await createRoomReservation(parsed.data, session.userId, {
      excludeAppointmentId,
      ignoreReferentialRules: assistantBooksUntilStart(session.role),
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: result.message, conflict: 'conflict' in result ? result.conflict : undefined },
        { status: result.error === 'ROOM_CONFLICT' ? 409 : 422 }
      );
    }

    return NextResponse.json({
      pending: result.pending,
      reservation: serializeRow(result.reservation),
    });
  } catch (err) {
    console.error('[room-reservations POST]', err);
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Erreur serveur lors de l’enregistrement. Redémarrez le serveur si le problème persiste.',
      },
      { status: 500 }
    );
  }
}
