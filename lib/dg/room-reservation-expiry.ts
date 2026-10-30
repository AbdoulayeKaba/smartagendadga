import type { RoomReservationStatus } from '@/lib/dg/room-reservation-review';

/** Motif stocké quand une demande PENDING expire (début du créneau passé). */
export const ROOM_AUTO_EXPIRE_PENDING_REASON =
  'Expirée automatiquement — le créneau a commencé sans validation.';

export function isRoomAutoExpiredPendingReason(reason: string | null | undefined) {
  if (!reason) return false;
  return reason.trim() === ROOM_AUTO_EXPIRE_PENDING_REASON;
}

function toMs(value: string | Date) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Demande en attente dont le début du créneau est passé. */
export function isPendingRoomReservationExpired(
  item: { status: RoomReservationStatus; startAt: string | Date },
  now: Date = new Date()
) {
  if (item.status !== 'PENDING') return false;
  const startMs = toMs(item.startAt);
  if (startMs === null) return false;
  return now.getTime() >= startMs;
}

/** Réservation confirmée dont la fin du créneau est passée. */
export function isConfirmedRoomReservationFinished(
  item: { status: RoomReservationStatus; endAt: string | Date },
  now: Date = new Date()
) {
  if (item.status !== 'CONFIRMED') return false;
  const endMs = toMs(item.endAt);
  if (endMs === null) return false;
  return now.getTime() >= endMs;
}

export type LiveRoomReservationStatus = RoomReservationStatus;

/**
 * Statut affiché immédiatement côté client (avant synchro serveur) :
 * - PENDING + début passé → REJECTED (expirée)
 * - CONFIRMED + fin passée → COMPLETED (terminée)
 */
export function resolveLiveRoomReservationStatus(
  item: {
    status: RoomReservationStatus;
    startAt: string | Date;
    endAt: string | Date;
    rejectionReason?: string | null;
  },
  now: Date = new Date()
): {
  status: LiveRoomReservationStatus;
  autoExpired: boolean;
} {
  if (isPendingRoomReservationExpired(item, now)) {
    return { status: 'REJECTED', autoExpired: true };
  }
  if (isConfirmedRoomReservationFinished(item, now)) {
    return { status: 'COMPLETED', autoExpired: false };
  }
  return {
    status: item.status,
    autoExpired: isRoomAutoExpiredPendingReason(item.rejectionReason),
  };
}

export function collectRoomReservationTransitionTimes(
  items: Array<{ status: RoomReservationStatus; startAt: string; endAt: string }>,
  now: Date = new Date(),
  { horizonMs = 6 * 60 * 60_000 }: { horizonMs?: number } = {}
): number[] {
  const nowMs = now.getTime();
  const limit = nowMs + horizonMs;
  const times = new Set<number>();

  for (const item of items) {
    const startMs = toMs(item.startAt);
    const endMs = toMs(item.endAt);

    // Uniquement les transitions futures (évite un refresh permanent chaque seconde).
    if (item.status === 'PENDING' && startMs !== null && startMs > nowMs && startMs <= limit) {
      times.add(startMs);
    }

    if (item.status === 'CONFIRMED' && endMs !== null && endMs > nowMs && endMs <= limit) {
      times.add(endMs);
    }
  }

  return [...times].sort((a, b) => a - b);
}

const LIVE_CLOCK_URGENT_MS = 5 * 60_000;

/** 1 s seulement près d’une transition future, sinon 30 s. */
export function resolveRoomLiveClockIntervalMs(
  items: Array<{ status: RoomReservationStatus; startAt: string; endAt: string }>,
  now: Date = new Date()
): number {
  const nowMs = now.getTime();
  for (const item of items) {
    const startMs = toMs(item.startAt);
    const endMs = toMs(item.endAt);
    if (
      item.status === 'PENDING' &&
      startMs !== null &&
      startMs > nowMs &&
      startMs - nowMs <= LIVE_CLOCK_URGENT_MS
    ) {
      return 1000;
    }
    if (
      item.status === 'CONFIRMED' &&
      endMs !== null &&
      endMs > nowMs &&
      endMs - nowMs <= LIVE_CLOCK_URGENT_MS
    ) {
      return 1000;
    }
  }
  return 30_000;
}

/** Empreinte des statuts live — stable tant que rien ne change réellement. */
export function buildRoomLiveStatusFingerprint(
  items: Array<{
    id: string;
    status: RoomReservationStatus;
    startAt: string;
    endAt: string;
    rejectionReason?: string | null;
  }>,
  now: Date = new Date()
): string {
  if (items.length === 0) return '';
  return items
    .map((item) => {
      const live = resolveLiveRoomReservationStatus(item, now);
      return `${item.id}:${live.status}:${live.autoExpired ? 1 : 0}`;
    })
    .join('|');
}
