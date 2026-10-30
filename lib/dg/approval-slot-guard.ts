import { formatTimeInAppTz } from '@/lib/datetime/format';
import {
  findSchedulingBlockedRange,
  type SchedulingBlockedRange,
} from '@/lib/dg/appointment-scheduling-context';
import { DG_BUFFER_MINUTES, DG_BUFFER_MS, rangesConflict } from '@/lib/dg/scheduling';

export type ApprovalSlotAppointment = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
};

/** Premier motif qui empêche de valider le créneau, ou null s’il est encore libre. */
export function describeApprovalSlotBlock(input: {
  startAt: Date;
  endAt: Date;
  dateKey: string;
  appointments: ApprovalSlotAppointment[];
  blockedRanges: SchedulingBlockedRange[];
}): string | null {
  const taken = input.appointments.find((item) =>
    rangesConflict(
      { startAt: input.startAt, endAt: input.endAt },
      item,
      DG_BUFFER_MS
    )
  );
  if (taken) {
    const start = formatTimeInAppTz(taken.startAt);
    const end = formatTimeInAppTz(taken.endAt);
    const title = taken.title.trim() || 'un autre rendez-vous';
    return `Ce créneau n’est plus libre : déjà occupé par « ${title} » (${start}–${end}).`;
  }

  const unavailable = findSchedulingBlockedRange(
    input.dateKey,
    input.blockedRanges.filter((range) => range.source === 'unavailability')
  );
  if (unavailable) {
    return unavailable.label
      ? `Ce créneau n’est plus libre : indisponibilité du DGA (${unavailable.label}).`
      : 'Ce créneau n’est plus libre : le DGA est indisponible à cette date.';
  }

  return null;
}

/**
 * Avertissement si le créneau empiète sur le tampon d’un rendez-vous déjà approuvé,
 * sans le chevaucher. Null si l’écart est suffisant.
 */
export function describeApprovalSlotMargin(input: {
  startAt: Date;
  endAt: Date;
  appointments: ApprovalSlotAppointment[];
}): string | null {
  const near = input.appointments.find((item) => {
    const overlaps =
      input.startAt.getTime() < item.endAt.getTime() && item.startAt.getTime() < input.endAt.getTime();
    if (overlaps) return false;
    return rangesConflict({ startAt: input.startAt, endAt: input.endAt }, item, DG_BUFFER_MS);
  });
  if (!near) return null;

  const start = formatTimeInAppTz(near.startAt);
  const end = formatTimeInAppTz(near.endAt);
  const title = near.title.trim() || 'un autre rendez-vous';
  return `Créneau proche de « ${title} » (${start}–${end}). Un intervalle de ${DG_BUFFER_MINUTES} min est recommandé.`;
}
