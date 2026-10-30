import { z } from 'zod';
import { isSlotStartInThePast, parseDateTime, PAST_SLOT_MESSAGE } from '@/lib/dg/scheduling';
import type { RoomEquipmentValue } from '@/lib/dg/room-reservation-form';
import { isMockDataEnabled } from '@/lib/mock/config';
import {
  mockApproveRoomReservation,
  mockArchiveRoomReservation,
  mockCancelRoomReservation,
  mockCountArchivedRoomReservations,
  mockCreateRoomReservation,
  mockDeleteRoomReservationPermanent,
  mockEmptyRoomReservationsTrash,
  mockListRoomReservations,
  mockRejectRoomReservation,
  mockRestoreRoomReservation,
  type RoomReservationRow,
  type RoomReservationStatus,
} from '@/lib/mock/room-reservations-store';
import { prisma } from '@/lib/prisma';
import { mockWriteAudit } from '@/lib/mock/audit';
import {
  appointmentMatchesRoom,
  getMeetingRoom,
  listMeetingRooms,
} from '@/lib/services/room-availability';
import type { RoomReservationReviewItem } from '@/lib/dg/room-reservation-review';
import {
  isExcludedRoomBooking,
  type RoomConflictExcludeOptions,
} from '@/lib/dg/room-conflict-exclude';
import {
  isReservableMeetingRoomName,
  ROOM_RESERVATION_SCOPE_MESSAGE,
} from '@/lib/dg/meeting-room-config';

export type { RoomConflictExcludeOptions };
export { isExcludedRoomBooking };

const equipmentSchema = z.array(
  z.enum(['videoprojecteur', 'micro', 'ecran'])
);

export const createRoomReservationSchema = z.object({
  roomId: z.string().min(1),
  roomName: z.string().min(1).max(200),
  title: z.string().min(3).max(191),
  usageType: z.enum(['REUNION', 'COMITE', 'FORMATION', 'ENTRETIEN', 'AUTRE']),
  organizerService: z.string().min(2).max(120),
  participantCount: z.number().int().min(1).max(500).optional(),
  equipment: equipmentSchema.default([]),
  logisticsNotes: z.string().max(2000).optional(),
  contactPhone: z.string().max(32).optional(),
  contactEmail: z
    .string()
    .max(191)
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'E-mail invalide' }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  bookingOrigin: z.enum(['SLOT', 'APPOINTMENT']).optional().default('SLOT'),
  appointmentId: z.string().min(1).max(191).optional(),
});

export type CreateRoomReservationInput = z.infer<typeof createRoomReservationSchema>;

function mapPrismaRow(row: {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  usageType: string;
  organizerService: string;
  participantCount: number | null;
  equipment: unknown;
  logisticsNotes: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  startAt: Date;
  endAt: Date;
  status: string;
  bookedById: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  assistantNote: string | null;
  bookingOrigin?: string | null;
  appointmentId?: string | null;
  archived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  bookedBy?: { id: string; firstName: string; lastName: string; email: string; phone: string | null };
}): RoomReservationRow {
  const inferredOrigin =
    row.bookingOrigin === 'APPOINTMENT' ||
    row.bookingOrigin === 'SLOT'
      ? row.bookingOrigin
      : /rendez[\s-]?vous/i.test(row.organizerService)
        ? 'APPOINTMENT'
        : 'SLOT';

  return {
    id: row.id,
    roomId: row.roomId,
    roomName: row.roomName,
    title: row.title,
    usageType: row.usageType as RoomReservationRow['usageType'],
    organizerService: row.organizerService,
    participantCount: row.participantCount,
    equipment: Array.isArray(row.equipment) ? (row.equipment as RoomEquipmentValue[]) : [],
    logisticsNotes: row.logisticsNotes,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    startAt: row.startAt,
    endAt: row.endAt,
    status: row.status as RoomReservationStatus,
    bookedById: row.bookedById,
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt,
    rejectionReason: row.rejectionReason,
    assistantNote: row.assistantNote ?? null,
    bookingOrigin: inferredOrigin,
    appointmentId: row.appointmentId ?? null,
    archived: row.archived,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    bookedBy: row.bookedBy,
  };
}

function resolveStatuses(
  status?: RoomReservationStatus | RoomReservationStatus[]
): RoomReservationStatus[] | undefined {
  if (!status) return undefined;
  return Array.isArray(status) ? status : [status];
}

async function auditRoomReservation(
  actorId: string,
  action: string,
  reservationId?: string,
  meta?: Record<string, unknown>
) {
  if (isMockDataEnabled()) {
    mockWriteAudit(actorId, action, reservationId);
    return;
  }
  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action,
      meta: { reservationId, ...meta },
    },
  });
}

export async function listRoomReservations(filters?: {
  from?: Date;
  to?: Date;
  roomId?: string;
  roomName?: string;
  status?: RoomReservationStatus | RoomReservationStatus[];
  bookedById?: string;
  includeBookedBy?: boolean;
  archived?: boolean;
}) {
  const statuses = resolveStatuses(filters?.status) ?? ['CONFIRMED'];
  const archived = filters?.archived ?? false;

  if (isMockDataEnabled()) {
    const { mockFindUserById } = await import('@/lib/mock/users-store');
    const rows = mockListRoomReservations({ ...filters, status: statuses, archived });
    if (!filters?.includeBookedBy) return rows;
    return rows.map((row) => {
      const user = mockFindUserById(row.bookedById);
      return {
        ...row,
        bookedBy: user
          ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone || null,
            }
          : undefined,
      };
    });
  }

  const rows = await prisma.roomReservation.findMany({
    where: {
      archived,
      status: statuses.length === 1 ? statuses[0] : { in: statuses },
      ...(filters?.bookedById ? { bookedById: filters.bookedById } : {}),
      ...(filters?.roomId ? { roomId: filters.roomId } : {}),
      ...(filters?.roomName ? { roomName: filters.roomName } : {}),
      ...(filters?.from || filters?.to
        ? {
            AND: [
              filters.from ? { endAt: { gte: filters.from } } : {},
              filters.to ? { startAt: { lte: filters.to } } : {},
            ],
          }
        : {}),
    },
    include: filters?.includeBookedBy
      ? { bookedBy: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } }
      : undefined,
    orderBy: archived ? { archivedAt: 'desc' } : { createdAt: 'desc' },
  });

  return rows.map(mapPrismaRow);
}

async function listBlockingRoomBookingsForDay(date: string, room: { id: string; name: string }) {
  const dayStart = parseDateTime(date, '00:00');
  const dayEnd = parseDateTime(date, '23:59');

  const reservations = await listRoomReservations({
    from: dayStart,
    to: dayEnd,
    roomId: room.id,
    status: 'CONFIRMED',
    archived: false,
  });

  const { listAppointments } = await import('@/lib/services/appointments');
  const appointments = (await listAppointments({ from: dayStart, to: dayEnd })).filter(
    (row) =>
      row.status !== 'REJECTED' &&
      row.status !== 'CANCELLED' &&
      appointmentMatchesRoom(row.location, room.name)
  );

  const merged: RoomBookingSlot[] = [
    ...reservations.map((r) => ({
      id: r.id,
      title: r.title,
      startAt: r.startAt,
      endAt: r.endAt,
      source: 'reservation' as const,
    })),
    ...appointments.map((a) => ({
      id: a.id,
      title: a.title,
      startAt: a.startAt,
      endAt: a.endAt,
      source: 'appointment' as const,
    })),
  ];

  return merged.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** La durée suit les créneaux libres consécutifs (1 h à 4 h), pas le pas d’un rendez-vous. */
async function assertSelectableRoomSpan(
  date: string,
  roomId: string,
  startTime: string,
  endTime: string,
  options?: RoomConflictExcludeOptions
) {
  const { getRoomAvailability } = await import('@/lib/services/room-availability');
  const { explainRoomSpan } = await import('@/lib/dg/room-slot-span');
  const availability = await getRoomAvailability(date, roomId, options);
  if (!availability) {
    return { ok: false as const, message: 'Impossible de vérifier les créneaux de la salle.' };
  }
  const span = explainRoomSpan(availability.slots, startTime, endTime);
  if (!span.ok) return { ok: false as const, message: span.message };
  return { ok: true as const };
}

export async function createRoomReservation(
  input: CreateRoomReservationInput,
  bookedById: string,
  options?: RoomConflictExcludeOptions
) {
  const startAt = parseDateTime(input.date, input.startTime);
  const endAt = parseDateTime(input.date, input.endTime);
  if (endAt <= startAt) {
    return { ok: false as const, error: 'INVALID_RANGE' as const, message: 'L’heure de fin doit être après le début.' };
  }
  if (isSlotStartInThePast(input.date, input.startTime)) {
    return { ok: false as const, error: 'SLOT_IN_PAST' as const, message: PAST_SLOT_MESSAGE };
  }

  const room = await getMeetingRoom(input.roomId);
  if (!room || room.name !== input.roomName) {
    return { ok: false as const, error: 'NOT_FOUND' as const, message: 'Salle introuvable.' };
  }
  if (!isReservableMeetingRoomName(room.name)) {
    return { ok: false as const, error: 'ROOM_NOT_RESERVABLE' as const, message: ROOM_RESERVATION_SCOPE_MESSAGE };
  }

  if (!options?.ignoreReferentialRules) {
    const span = await assertSelectableRoomSpan(
      input.date,
      input.roomId,
      input.startTime,
      input.endTime,
      options
    );
    if (!span.ok) {
      return { ok: false as const, error: 'DURATION_NOT_ALLOWED' as const, message: span.message };
    }

    const { getPlatformSettings } = await import('@/lib/services/platform-settings');
    const platform = await getPlatformSettings();

    const bookings = (await listBlockingRoomBookingsForDay(input.date, room)).filter(
      (row) => !isExcludedRoomBooking(row, options)
    );
    const bufferMs = platform.bufferMinutes * 60 * 1000;
    const conflict = bookings.find(
      (row) =>
        startAt.getTime() < row.endAt.getTime() + bufferMs &&
        endAt.getTime() > row.startAt.getTime() - bufferMs
    );
    if (conflict) {
      return {
        ok: false as const,
        error: 'ROOM_CONFLICT' as const,
        message: `La salle est déjà réservée (« ${conflict.title} »).`,
        conflict: {
          id: conflict.id,
          title: conflict.title,
          startAt: conflict.startAt.toISOString(),
          endAt: conflict.endAt.toISOString(),
        },
      };
    }
  }

  const initialStatus: RoomReservationStatus = 'PENDING';

  const payload = {
    roomId: input.roomId,
    roomName: input.roomName,
    title: input.title,
    usageType: input.usageType,
    organizerService: input.organizerService,
    participantCount: input.participantCount ?? null,
    equipment: input.equipment,
    logisticsNotes: input.logisticsNotes ?? null,
    contactPhone: input.contactPhone ?? null,
    contactEmail: input.contactEmail || null,
    startAt,
    endAt,
    bookedById,
    status: initialStatus,
    reviewedById: null,
    reviewedAt: null,
    rejectionReason: null,
    bookingOrigin: input.bookingOrigin ?? 'SLOT',
    appointmentId: input.appointmentId?.trim() || null,
  };

  if (isMockDataEnabled()) {
    const row = mockCreateRoomReservation({
      ...payload,
      participantCount: input.participantCount,
      equipment: input.equipment,
      logisticsNotes: input.logisticsNotes,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail || undefined,
      status: initialStatus,
      bookingOrigin: payload.bookingOrigin,
      appointmentId: payload.appointmentId,
    });
    return { ok: true as const, reservation: row, pending: initialStatus === 'PENDING' };
  }

  const row = await prisma.roomReservation.create({
    data: {
      roomId: payload.roomId,
      roomName: payload.roomName,
      title: payload.title,
      usageType: payload.usageType,
      organizerService: payload.organizerService,
      participantCount: payload.participantCount,
      equipment: input.equipment,
      logisticsNotes: payload.logisticsNotes,
      contactPhone: payload.contactPhone,
      contactEmail: payload.contactEmail,
      startAt: payload.startAt,
      endAt: payload.endAt,
      bookedById: payload.bookedById,
      status: payload.status,
      reviewedById: payload.reviewedById,
      reviewedAt: payload.reviewedAt,
    },
  });

  // Persiste l’origine même si le client Prisma n’a pas encore régénéré les champs.
  try {
    await prisma.$executeRaw`
      UPDATE room_reservations
      SET booking_origin = ${payload.bookingOrigin},
          appointment_id = ${payload.appointmentId}
      WHERE id = ${row.id}
    `;
  } catch {
    /* migration absente ou client verrouillé — l’UI s’appuie aussi sur les heuristiques */
  }

  return {
    ok: true as const,
    reservation: mapPrismaRow({
      ...row,
      bookingOrigin: payload.bookingOrigin,
      appointmentId: payload.appointmentId,
    }),
    pending: initialStatus === 'PENDING',
  };
}

export const updateRoomReservationSchema = createRoomReservationSchema;

export async function updateRoomReservation(
  reservationId: string,
  input: CreateRoomReservationInput,
  actorId: string,
  options: { asReviewer: boolean } & RoomConflictExcludeOptions
) {
  const existing = isMockDataEnabled()
    ? (await import('@/lib/mock/room-reservations-store')).mockListRoomReservations().find((r) => r.id === reservationId)
    : await prisma.roomReservation.findUnique({ where: { id: reservationId } });

  if (!existing || existing.archived) {
    return { ok: false as const, error: 'NOT_FOUND' as const };
  }
  if (existing.status === 'REJECTED' || existing.status === 'CANCELLED') {
    return { ok: false as const, error: 'NOT_EDITABLE' as const, message: 'Cette réservation ne peut plus être modifiée.' };
  }
  if (!options.asReviewer) {
    if (existing.bookedById !== actorId || existing.status !== 'PENDING') {
      return { ok: false as const, error: 'FORBIDDEN' as const, message: 'Modification non autorisée.' };
    }
  } else if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
    return { ok: false as const, error: 'NOT_EDITABLE' as const, message: 'Cette réservation ne peut plus être modifiée.' };
  }

  const startAt = parseDateTime(input.date, input.startTime);
  const endAt = parseDateTime(input.date, input.endTime);
  if (endAt <= startAt) {
    return { ok: false as const, error: 'INVALID_RANGE' as const, message: 'L’heure de fin doit être après le début.' };
  }
  if (isSlotStartInThePast(input.date, input.startTime)) {
    return { ok: false as const, error: 'SLOT_IN_PAST' as const, message: PAST_SLOT_MESSAGE };
  }

  const room = await getMeetingRoom(input.roomId);
  if (!room || room.name !== input.roomName) {
    return { ok: false as const, error: 'NOT_FOUND' as const, message: 'Salle introuvable.' };
  }
  if (!isReservableMeetingRoomName(room.name)) {
    return { ok: false as const, error: 'ROOM_NOT_RESERVABLE' as const, message: ROOM_RESERVATION_SCOPE_MESSAGE };
  }

  if (!options.ignoreReferentialRules) {
    const span = await assertSelectableRoomSpan(input.date, input.roomId, input.startTime, input.endTime, {
      excludeReservationId: reservationId,
      excludeAppointmentId: options.excludeAppointmentId,
    });
    if (!span.ok) {
      return { ok: false as const, error: 'DURATION_NOT_ALLOWED' as const, message: span.message };
    }

    const { getPlatformSettings } = await import('@/lib/services/platform-settings');
    const platform = await getPlatformSettings();

    const bookings = (await listBlockingRoomBookingsForDay(input.date, room)).filter(
      (b) =>
        !isExcludedRoomBooking(b, {
          excludeReservationId: reservationId,
          excludeAppointmentId: options.excludeAppointmentId,
        })
    );
    const bufferMs = platform.bufferMinutes * 60 * 1000;
    const conflict = bookings.find(
      (row) =>
        startAt.getTime() < row.endAt.getTime() + bufferMs &&
        endAt.getTime() > row.startAt.getTime() - bufferMs
    );
    if (conflict) {
      return {
        ok: false as const,
        error: 'ROOM_CONFLICT' as const,
        message: `La salle est déjà réservée (« ${conflict.title} »).`,
        conflict: {
          id: conflict.id,
          title: conflict.title,
          startAt: conflict.startAt.toISOString(),
          endAt: conflict.endAt.toISOString(),
        },
      };
    }
  }

  const payload = {
    roomId: input.roomId,
    roomName: input.roomName,
    title: input.title,
    usageType: input.usageType,
    organizerService: input.organizerService,
    participantCount: input.participantCount ?? null,
    equipment: input.equipment,
    logisticsNotes: input.logisticsNotes ?? null,
    contactPhone: input.contactPhone ?? null,
    contactEmail: input.contactEmail || null,
    startAt,
    endAt,
  };

  const creneauChanged =
    existing.startAt.getTime() !== startAt.getTime() || existing.endAt.getTime() !== endAt.getTime();
  const revertToPending = creneauChanged && existing.status === 'CONFIRMED';
  const statusPatch = revertToPending
    ? {
        status: 'PENDING' as const,
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
        assistantNote: null,
      }
    : {};

  if (isMockDataEnabled()) {
    const { mockUpdateRoomReservation } = await import('@/lib/mock/room-reservations-store');
    const row = mockUpdateRoomReservation(reservationId, {
      ...payload,
      participantCount: input.participantCount,
      equipment: input.equipment,
      logisticsNotes: input.logisticsNotes,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail || undefined,
      ...statusPatch,
    });
    if (!row) return { ok: false as const, error: 'NOT_FOUND' as const };
    return { ok: true as const, reservation: row, pending: revertToPending };
  }

  const row = await prisma.roomReservation.update({
    where: { id: reservationId },
    data: {
      roomId: payload.roomId,
      roomName: payload.roomName,
      title: payload.title,
      usageType: payload.usageType,
      organizerService: payload.organizerService,
      participantCount: payload.participantCount,
      equipment: input.equipment,
      logisticsNotes: payload.logisticsNotes,
      contactPhone: payload.contactPhone,
      contactEmail: payload.contactEmail,
      startAt: payload.startAt,
      endAt: payload.endAt,
      ...statusPatch,
    },
  });

  return { ok: true as const, reservation: mapPrismaRow(row), pending: revertToPending };
}

export async function approveRoomReservation(
  reservationId: string,
  reviewerId: string,
  options?: { ignoreReferentialRules?: boolean }
) {
  if (isMockDataEnabled()) {
    const row = mockApproveRoomReservation(reservationId, reviewerId);
    if (!row) return { ok: false as const, error: 'NOT_FOUND' as const };
    return { ok: true as const, reservation: row };
  }

  const existing = await prisma.roomReservation.findUnique({ where: { id: reservationId } });
  if (!existing || existing.status !== 'PENDING' || existing.archived) {
    return { ok: false as const, error: 'NOT_FOUND' as const };
  }

  const room = await getMeetingRoom(existing.roomId);
  if (!room) return { ok: false as const, error: 'NOT_FOUND' as const };

  if (!options?.ignoreReferentialRules) {
    const date = existing.startAt.toISOString().slice(0, 10);
    const bookings = (await listBlockingRoomBookingsForDay(date, room)).filter((b) => b.id !== existing.id);
    const { getPlatformSettings } = await import('@/lib/services/platform-settings');
    const platform = await getPlatformSettings();
    const bufferMs = platform.bufferMinutes * 60 * 1000;
    const conflict = bookings.find(
      (row) =>
        existing.startAt.getTime() < row.endAt.getTime() + bufferMs &&
        existing.endAt.getTime() > row.startAt.getTime() - bufferMs
    );
    if (conflict) {
      return {
        ok: false as const,
        error: 'ROOM_CONFLICT' as const,
        message: `Créneau indisponible (« ${conflict.title} »).`,
        conflict: {
          id: conflict.id,
          title: conflict.title,
          startAt: conflict.startAt.toISOString(),
          endAt: conflict.endAt.toISOString(),
        },
      };
    }
  }

  const now = new Date();
  const row = await prisma.roomReservation.update({
    where: { id: reservationId },
    data: {
      status: 'CONFIRMED',
      reviewedById: reviewerId,
      reviewedAt: now,
      assistantNote: null,
    },
  });

  return { ok: true as const, reservation: mapPrismaRow(row) };
}

/** Refus d’une réservation de salle encore en attente. */
export async function rejectRoomReservation(
  reservationId: string,
  reviewerId: string,
  reason?: string
) {
  const trimmed = reason?.trim() ?? '';
  if (trimmed.length < 3) {
    return {
      ok: false as const,
      error: 'REASON_REQUIRED' as const,
      message: 'Le motif du refus est obligatoire (3 caractères minimum).',
    };
  }

  if (isMockDataEnabled()) {
    const row = mockRejectRoomReservation(reservationId, reviewerId, trimmed);
    if (!row) return { ok: false as const, error: 'NOT_FOUND' as const };
    return { ok: true as const, reservation: row };
  }

  const existing = await prisma.roomReservation.findUnique({ where: { id: reservationId } });
  if (!existing || existing.status !== 'PENDING' || existing.archived) {
    return { ok: false as const, error: 'NOT_FOUND' as const };
  }

  const now = new Date();
  const row = await prisma.roomReservation.update({
    where: { id: reservationId },
    data: {
      status: 'REJECTED',
      reviewedById: reviewerId,
      reviewedAt: now,
      rejectionReason: trimmed,
      assistantNote: null,
    },
  });

  return { ok: true as const, reservation: mapPrismaRow(row) };
}

/**
 * Confirme automatiquement les réservations de salle liées à un RDV validé.
 * - Cible directe via roomReservationId (meta RDV)
 * - Cible complémentaire via appointment_id si la colonne est renseignée
 */
export async function confirmRoomReservationsForAppointment(input: {
  appointmentId: string;
  reviewerId: string;
  roomReservationId?: string | null;
}) {
  const roomReservationId = input.roomReservationId?.trim() || null;

  if (isMockDataEnabled()) {
    if (!roomReservationId) return { updated: 0 };
    const row = mockApproveRoomReservation(roomReservationId, input.reviewerId);
    return { updated: row ? 1 : 0 };
  }

  const now = new Date();
  let updated = 0;

  if (roomReservationId) {
    const direct = await prisma.roomReservation.updateMany({
      where: {
        id: roomReservationId,
        archived: false,
        status: 'PENDING',
      },
      data: {
        status: 'CONFIRMED',
        reviewedById: input.reviewerId,
        reviewedAt: now,
        assistantNote: null,
      },
    });
    updated += direct.count;
  }

  // Compatibilité: champ appointment_id peut exister en base même si client Prisma non régénéré.
  try {
    if (roomReservationId) {
      const byAppointment = await prisma.$executeRaw`
        UPDATE room_reservations
        SET status = 'CONFIRMED',
            reviewed_by_id = ${input.reviewerId},
            reviewed_at = ${now},
            assistant_note = NULL
        WHERE appointment_id = ${input.appointmentId}
          AND id <> ${roomReservationId}
          AND archived = 0
          AND status = 'PENDING'
      `;
      updated += Number(byAppointment ?? 0);
    } else {
      const byAppointment = await prisma.$executeRaw`
        UPDATE room_reservations
        SET status = 'CONFIRMED',
            reviewed_by_id = ${input.reviewerId},
            reviewed_at = ${now},
            assistant_note = NULL
        WHERE appointment_id = ${input.appointmentId}
          AND archived = 0
          AND status = 'PENDING'
      `;
      updated += Number(byAppointment ?? 0);
    }
  } catch {
    // migration pas encore appliquée: on garde la confirmation directe si possible.
  }

  return { updated };
}

export const proposeRoomReservationSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().min(3).max(500).optional(),
});

export type ProposeRoomReservationSlotInput = z.infer<typeof proposeRoomReservationSlotSchema>;

export async function proposeRoomReservationSlot(
  reservationId: string,
  reviewerId: string,
  input: ProposeRoomReservationSlotInput,
  options?: { ignoreReferentialRules?: boolean }
) {
  const existing = isMockDataEnabled()
    ? mockListRoomReservations().find((r) => r.id === reservationId)
    : await prisma.roomReservation.findUnique({ where: { id: reservationId } });

  if (!existing || existing.archived || existing.status !== 'PENDING') {
    return { ok: false as const, error: 'NOT_FOUND' as const };
  }

  const startAt = parseDateTime(input.date, input.startTime);
  const endAt = parseDateTime(input.date, input.endTime);
  if (endAt <= startAt) {
    return { ok: false as const, error: 'INVALID_RANGE' as const, message: 'L’heure de fin doit être après le début.' };
  }
  if (isSlotStartInThePast(input.date, input.startTime)) {
    return { ok: false as const, error: 'SLOT_IN_PAST' as const, message: PAST_SLOT_MESSAGE };
  }

  const room = await getMeetingRoom(existing.roomId);
  if (!room) {
    return { ok: false as const, error: 'NOT_FOUND' as const, message: 'Salle introuvable.' };
  }
  if (!isReservableMeetingRoomName(room.name)) {
    return { ok: false as const, error: 'ROOM_NOT_RESERVABLE' as const, message: ROOM_RESERVATION_SCOPE_MESSAGE };
  }

  if (!options?.ignoreReferentialRules) {
    const span = await assertSelectableRoomSpan(input.date, existing.roomId, input.startTime, input.endTime, {
      excludeReservationId: reservationId,
    });
    if (!span.ok) {
      return { ok: false as const, error: 'DURATION_NOT_ALLOWED' as const, message: span.message };
    }

    const { getPlatformSettings } = await import('@/lib/services/platform-settings');
    const platform = await getPlatformSettings();

    const bookings = (await listBlockingRoomBookingsForDay(input.date, room)).filter((b) => b.id !== reservationId);
    const bufferMs = platform.bufferMinutes * 60 * 1000;
    const conflict = bookings.find(
      (row) =>
        startAt.getTime() < row.endAt.getTime() + bufferMs &&
        endAt.getTime() > row.startAt.getTime() - bufferMs
    );
    if (conflict) {
      return {
        ok: false as const,
        error: 'ROOM_CONFLICT' as const,
        message: `La salle est déjà réservée (« ${conflict.title} »).`,
        conflict: {
          id: conflict.id,
          title: conflict.title,
          startAt: conflict.startAt.toISOString(),
          endAt: conflict.endAt.toISOString(),
        },
      };
    }
  }

  const note = input.note?.trim() || null;

  if (isMockDataEnabled()) {
    const { mockProposeRoomReservationSlot } = await import('@/lib/mock/room-reservations-store');
    const row = mockProposeRoomReservationSlot(reservationId, reviewerId, { startAt, endAt, note: note ?? undefined });
    if (!row) return { ok: false as const, error: 'NOT_FOUND' as const };
    return { ok: true as const, reservation: row, pending: true };
  }

  const row = await prisma.roomReservation.update({
    where: { id: reservationId },
    data: {
      startAt,
      endAt,
      status: 'PENDING',
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
      assistantNote: note,
    },
  });

  return { ok: true as const, reservation: mapPrismaRow(row), pending: true };
}

export async function cancelRoomReservation(
  reservationId: string,
  actorId: string,
  options: { asReviewer: boolean }
) {
  if (isMockDataEnabled()) {
    const row = mockCancelRoomReservation(reservationId, actorId, options.asReviewer);
    if (!row) return { ok: false as const, error: 'NOT_FOUND' as const };
    return { ok: true as const, reservation: row };
  }

  const existing = await prisma.roomReservation.findUnique({ where: { id: reservationId } });
  if (!existing || existing.archived) return { ok: false as const, error: 'NOT_FOUND' as const };
  if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
    return { ok: false as const, error: 'NOT_FOUND' as const };
  }
  if (!options.asReviewer && existing.bookedById !== actorId) {
    return { ok: false as const, error: 'FORBIDDEN' as const, message: 'Action non autorisée.' };
  }

  const now = new Date();
  const row = await prisma.roomReservation.update({
    where: { id: reservationId },
    data: {
      status: 'CANCELLED',
      reviewedById: options.asReviewer ? actorId : existing.reviewedById,
      reviewedAt: now,
    },
  });

  return { ok: true as const, reservation: mapPrismaRow(row) };
}

export type RoomBookingSlot = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  source: 'reservation' | 'appointment';
};

export async function listRoomBookingsForDay(date: string, room: { id: string; name: string }) {
  return listBlockingRoomBookingsForDay(date, room);
}

type AppointmentOccupancyRow = {
  id: string;
  title: string;
  location: string | null;
  startAt: Date;
  endAt: Date;
  status: string;
  requestedById: string;
  reviewedAt: Date | null;
  createdAt: Date;
  requestedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
};

function resolveRoomForAppointmentLocation(
  location: string,
  rooms: Awaited<ReturnType<typeof listMeetingRooms>>
) {
  return (
    rooms.find((room) => appointmentMatchesRoom(location, room.name)) ??
    null
  );
}

function mapAppointmentToOccupancyItem(
  appointment: AppointmentOccupancyRow,
  room: { id: string; name: string }
): RoomReservationReviewItem {
  const requestedBy = appointment.requestedBy;
  const bookedByName = requestedBy
    ? `${requestedBy.firstName} ${requestedBy.lastName}`.trim()
    : 'Demandeur';

  return {
    id: `appt-${appointment.id}`,
    source: 'appointment',
    appointmentId: appointment.id,
    roomId: room.id,
    roomName: room.name,
    title: appointment.title,
    usageType: 'REUNION',
    organizerService: 'Audience DGA',
    participantCount: null,
    equipment: [],
    logisticsNotes: null,
    contactPhone: requestedBy?.phone ?? null,
    contactEmail: requestedBy?.email ?? null,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    status: appointment.status === 'APPROVED' ? 'CONFIRMED' : 'PENDING',
    bookedById: appointment.requestedById,
    bookedByName,
    bookedByEmail: requestedBy?.email ?? '',
    bookedByPhone: requestedBy?.phone ?? '',
    reviewedAt: appointment.reviewedAt?.toISOString() ?? null,
    rejectionReason: null,
    assistantNote: null,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.createdAt.toISOString(),
  };
}

/** Audiences DGA dont le lieu correspond à une salle de réunion (occupation agenda). */
export async function listMeetingRoomAppointmentOccupancy(filters?: {
  from?: Date;
  to?: Date;
  roomId?: string;
  status?: RoomReservationStatus | RoomReservationStatus[];
}) {
  const rooms = await listMeetingRooms();
  if (!rooms.length) return [] as RoomReservationReviewItem[];

  const { listAppointments } = await import('@/lib/services/appointments');
  const appointments = (await listAppointments({
    from: filters?.from,
    to: filters?.to,
  })) as AppointmentOccupancyRow[];

  const statuses = resolveStatuses(filters?.status);
  const includeApproved = !statuses || statuses.includes('CONFIRMED');
  const includePending = !statuses || statuses.includes('PENDING');

  const items: RoomReservationReviewItem[] = [];

  for (const appointment of appointments) {
    if (!appointment.location?.trim()) continue;
    if (appointment.status === 'REJECTED') continue;
    if (appointment.status === 'APPROVED' && !includeApproved) continue;
    if (appointment.status === 'PENDING' && !includePending) continue;
    if (appointment.status !== 'APPROVED' && appointment.status !== 'PENDING') continue;

    const room = resolveRoomForAppointmentLocation(appointment.location, rooms);
    if (!room) continue;
    if (filters?.roomId && room.id !== filters.roomId) continue;

    items.push(mapAppointmentToOccupancyItem(appointment, room));
  }

  return items.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
}

export async function countPendingRoomReservations() {
  if (isMockDataEnabled()) {
    return mockListRoomReservations({ status: 'PENDING', archived: false }).length;
  }
  return prisma.roomReservation.count({ where: { status: 'PENDING', archived: false } });
}

export async function archiveRoomReservation(
  reservationId: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const row = mockArchiveRoomReservation(reservationId);
    if (!row) return { ok: false, error: 'NOT_FOUND' };
    await auditRoomReservation(actorId, 'room_reservation.archive', reservationId);
    return { ok: true };
  }

  const current = await prisma.roomReservation.findUnique({ where: { id: reservationId } });
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  if (current.archived) return { ok: false, error: 'ALREADY_ARCHIVED' };

  await prisma.roomReservation.update({
    where: { id: reservationId },
    data: { archived: true, archivedAt: new Date() },
  });
  await auditRoomReservation(actorId, 'room_reservation.archive', reservationId);
  return { ok: true };
}

export async function restoreRoomReservation(
  reservationId: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const row = mockRestoreRoomReservation(reservationId);
    if (!row) return { ok: false, error: 'NOT_FOUND' };
    await auditRoomReservation(actorId, 'room_reservation.restore', reservationId);
    return { ok: true };
  }

  const current = await prisma.roomReservation.findUnique({ where: { id: reservationId } });
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  if (!current.archived) return { ok: false, error: 'NOT_ARCHIVED' };

  await prisma.roomReservation.update({
    where: { id: reservationId },
    data: { archived: false, archivedAt: null },
  });
  await auditRoomReservation(actorId, 'room_reservation.restore', reservationId);
  return { ok: true };
}

export async function deleteRoomReservationPermanent(
  reservationId: string,
  actorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isMockDataEnabled()) {
    const ok = mockDeleteRoomReservationPermanent(reservationId);
    if (!ok) return { ok: false, error: 'NOT_FOUND' };
    await auditRoomReservation(actorId, 'room_reservation.delete', reservationId);
    return { ok: true };
  }

  const current = await prisma.roomReservation.findUnique({ where: { id: reservationId } });
  if (!current) return { ok: false, error: 'NOT_FOUND' };
  if (!current.archived) return { ok: false, error: 'NOT_ARCHIVED' };

  await prisma.roomReservation.delete({ where: { id: reservationId } });
  await auditRoomReservation(actorId, 'room_reservation.delete', reservationId);
  return { ok: true };
}

export async function emptyRoomReservationsTrash(
  actorId: string
): Promise<{ purged: number }> {
  if (isMockDataEnabled()) {
    const purged = mockEmptyRoomReservationsTrash();
    if (purged > 0) await auditRoomReservation(actorId, 'room_reservation.trash.empty', undefined, { purged });
    return { purged };
  }

  const result = await prisma.roomReservation.deleteMany({ where: { archived: true } });
  if (result.count > 0) {
    await auditRoomReservation(actorId, 'room_reservation.trash.empty', undefined, { purged: result.count });
  }
  return { purged: result.count };
}

export async function countArchivedRoomReservations() {
  if (isMockDataEnabled()) {
    return mockCountArchivedRoomReservations();
  }
  return prisma.roomReservation.count({ where: { archived: true } });
}
