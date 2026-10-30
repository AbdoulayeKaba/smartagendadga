import { prisma } from '@/lib/prisma';
import { ROOM_AUTO_EXPIRE_PENDING_REASON } from '@/lib/dg/room-reservation-expiry';
import { isMockDataEnabled } from '@/lib/mock/config';
import { mockAutoExpireRoomReservations } from '@/lib/mock/room-reservations-store';
import { writeAudit } from '@/lib/services/appointments';

let lastAutoExpireRunAt = 0;

/** Intervalle minimal entre deux passes d’expiration déclenchées par les lectures API. */
export const ROOM_AUTO_EXPIRE_READ_INTERVAL_MS = 60_000;

export type RoomAutoExpireResult = {
  expired: number;
  completed: number;
  expiredIds: string[];
  completedIds: string[];
};

/**
 * Adaptations automatiques des réservations salles :
 * - PENDING dont le début est passé → REJECTED (expirée)
 * Les CONFIRMED passées sont affichées « Terminée » côté UI (sans migration de schéma).
 */
export async function autoExpireRoomReservations(options?: {
  now?: Date;
  force?: boolean;
}): Promise<RoomAutoExpireResult> {
  const now = options?.now ?? new Date();

  if (!options?.force) {
    const elapsed = now.getTime() - lastAutoExpireRunAt;
    if (elapsed < ROOM_AUTO_EXPIRE_READ_INTERVAL_MS) {
      return { expired: 0, completed: 0, expiredIds: [], completedIds: [] };
    }
  }

  lastAutoExpireRunAt = now.getTime();

  if (isMockDataEnabled()) {
    return mockAutoExpireRoomReservations(now);
  }

  const empty: RoomAutoExpireResult = {
    expired: 0,
    completed: 0,
    expiredIds: [],
    completedIds: [],
  };

  const expiredPending = await prisma.roomReservation.findMany({
    where: {
      status: 'PENDING',
      archived: false,
      startAt: { lte: now },
    },
    select: { id: true },
  });

  if (expiredPending.length === 0) {
    return empty;
  }

  const expiredIds = expiredPending.map((r) => r.id);

  await prisma.roomReservation.updateMany({
    where: { id: { in: expiredIds }, status: 'PENDING', archived: false },
    data: {
      status: 'REJECTED',
      rejectionReason: ROOM_AUTO_EXPIRE_PENDING_REASON,
      reviewedAt: now,
      updatedAt: now,
    },
  });

  try {
    const actor =
      (await prisma.user.findFirst({
        where: { role: { in: ['ASSISTANT', 'DG'] }, active: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })) ?? null;

    if (actor) {
      for (const id of expiredIds) {
        await writeAudit(actor.id, 'room_reservation.auto_expire_pending', id, {
          reason: ROOM_AUTO_EXPIRE_PENDING_REASON,
        });
      }
    }
  } catch {
    /* audit best-effort */
  }

  return {
    expired: expiredIds.length,
    completed: 0,
    expiredIds,
    completedIds: [],
  };
}
