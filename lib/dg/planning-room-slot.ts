import { timeToMinutes } from '@/lib/dg/schedule-capacity';
import type { AvailabilitySlot } from '@/lib/services/dg-availability';

export type PlanningRoomSlotStatus =
  | 'idle'
  | 'loading'
  | 'available'
  | 'busy'
  | 'blocked'
  | 'outside'
  | 'error'
  | 'margin';

export type PlanningRoomSlotEvaluation = {
  ok: boolean;
  status: PlanningRoomSlotStatus;
  message: string;
};

/** Évalue si le créneau RDV est libre dans la grille de disponibilité salle. */
export function evaluatePlanningRoomSlot(
  slots: AvailabilitySlot[],
  startTime: string,
  endTime: string
): PlanningRoomSlotEvaluation {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return {
      ok: false,
      status: 'blocked',
      message: 'Horaires invalides pour la réservation de salle.',
    };
  }

  const overlapping = slots.filter((slot) => {
    const a = timeToMinutes(slot.startTime);
    const b = timeToMinutes(slot.endTime);
    return a < end && b > start;
  });

  if (overlapping.length === 0) {
    return {
      ok: false,
      status: 'outside',
      message: 'Ce créneau est hors des horaires d’ouverture de la salle.',
    };
  }

  const busy = overlapping.find((slot) => slot.status === 'BUSY');
  if (busy) {
    return {
      ok: false,
      status: 'busy',
      message: busy.reason ?? busy.label ?? 'La salle est déjà réservée sur ce créneau.',
    };
  }

  const buffer = overlapping.find((slot) => slot.status === 'BUFFER');
  if (buffer) {
    return {
      ok: true,
      status: 'margin',
      message:
        buffer.reason ??
        'Avertissement : marge opérationnelle avec un autre créneau. Ce n’est pas un conflit.',
    };
  }

  const blocked = overlapping.find((slot) => slot.status === 'BLOCKED');
  if (blocked) {
    return {
      ok: false,
      status: 'blocked',
      message: blocked.reason ?? 'Ce créneau n’est pas ouvert à la réservation.',
    };
  }

  return {
    ok: true,
    status: 'available',
    message: `Salle disponible sur le créneau du rendez-vous (${startTime}–${endTime}).`,
  };
}
