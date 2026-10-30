import { getApprovedAppointmentPhase } from '@/lib/dg/appointments-review';

export type CalendarDragAppointment = {
  status: string;
  startAt: string | Date;
  endAt: string | Date;
};

export function parseAppointmentInstant(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toPhaseInput(appt: CalendarDragAppointment) {
  const startAt = parseAppointmentInstant(appt.startAt);
  const endAt = parseAppointmentInstant(appt.endAt);
  if (!startAt || !endAt) return null;
  return {
    status: appt.status as 'APPROVED' | 'PENDING' | 'REJECTED',
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  };
}

/** RDV approuvé dont la fin de créneau est dépassée. */
export function isCalendarAppointmentPast(
  appt: CalendarDragAppointment,
  now: Date = new Date()
): boolean {
  const input = toPhaseInput(appt);
  if (!input || input.status !== 'APPROVED') return false;
  return getApprovedAppointmentPhase(input, now) === 'past';
}

/** Seuls les RDV approuvés à venir peuvent être déplacés par glisser-déposer. */
export function canDragCalendarAppointment(
  appt: CalendarDragAppointment,
  dragEnabled: boolean,
  now: Date = new Date()
): boolean {
  if (!dragEnabled || appt.status !== 'APPROVED') return false;
  const input = toPhaseInput(appt);
  if (!input) return false;
  return getApprovedAppointmentPhase(input, now) === 'upcoming';
}

export const CALENDAR_DRAG_BLOCKED_MESSAGE =
  'Un rendez-vous déjà commencé ou passé ne peut pas être reprogrammé par glisser-déposer.';
