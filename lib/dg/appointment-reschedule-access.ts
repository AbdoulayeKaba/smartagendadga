import type { AppointmentStatus } from '@prisma/client';
import { getApprovedAppointmentPhase } from '@/lib/dg/appointments-review';
import type { DgRole } from '@/lib/dg/rbac';

export type RescheduleSlotInput = {
  status: string;
  startAt: string | Date;
  endAt: string | Date;
};

export const APPOINTMENT_NOT_RESCHEDULABLE_MESSAGE =
  'Un rendez-vous passé ne peut pas être reporté.';

export const APPOINTMENT_PAST_LOCKED_MESSAGE =
  'Un rendez-vous passé ne peut pas être modifié ni annulé.';

/** Le créneau est terminé : il n’est plus possible de le reporter. */
export function isAppointmentSlotPast(
  slot: { endAt?: string | Date | null },
  now: Date = new Date()
): boolean {
  if (!slot.endAt) return false;
  const end = slot.endAt instanceof Date ? slot.endAt : new Date(slot.endAt);
  return !Number.isNaN(end.getTime()) && now.getTime() > end.getTime();
}

/** Seuls les RDV approuvés à venir peuvent être replanifiés (hors validation initiale en attente). */
export function isAppointmentReschedulable(
  appt: RescheduleSlotInput,
  now: Date = new Date()
): boolean {
  if (appt.status === 'PENDING') return true;
  if (appt.status !== 'APPROVED') return false;

  const startAt =
    appt.startAt instanceof Date ? appt.startAt.toISOString() : String(appt.startAt);
  const endAt = appt.endAt instanceof Date ? appt.endAt.toISOString() : String(appt.endAt);

  return (
    getApprovedAppointmentPhase({ status: 'APPROVED', startAt, endAt }, now) === 'upcoming'
  );
}

/** Modifier un rendez-vous à venir ou en attente, jamais un créneau déjà terminé. */
export function canReviewerEditAppointment(
  _role: DgRole | undefined,
  permissions: Record<string, boolean>,
  status: AppointmentStatus,
  slot?: { startAt?: string | Date | null; endAt?: string | Date | null; now?: Date }
): boolean {
  if (permissions['action.appointments.edit'] !== true) return false;
  if (status !== 'PENDING' && status !== 'APPROVED') return false;

  const now = slot?.now ?? new Date();
  if (isAppointmentSlotPast({ endAt: slot?.endAt }, now)) return false;
  if (status === 'PENDING') return true;

  const startAt = slot?.startAt;
  const endAt = slot?.endAt;
  if (!startAt || !endAt) return false;
  const phase = getApprovedAppointmentPhase(
    {
      status: 'APPROVED',
      startAt: startAt instanceof Date ? startAt.toISOString() : String(startAt),
      endAt: endAt instanceof Date ? endAt.toISOString() : String(endAt),
    },
    now
  );
  return phase === 'upcoming';
}
