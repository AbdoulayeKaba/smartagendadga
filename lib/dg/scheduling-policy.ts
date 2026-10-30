import type { PlatformConfig, WeekdayKey } from '@/lib/dg/platform-config';
import type { UnavailabilityMeta } from '@/lib/dg/referential-types';
import { getHolidayMeta } from '@/lib/dg/referential-types';

const WEEKDAY_FROM_DATE: Record<number, WeekdayKey> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

export function weekdayKeyFromDate(isoDate: string): WeekdayKey {
  return WEEKDAY_FROM_DATE[new Date(`${isoDate}T12:00:00`).getDay()];
}

export function isWorkingDayDate(isoDate: string, workingDays: WeekdayKey[]): boolean {
  if (workingDays.length === 0) return true;
  return workingDays.includes(weekdayKeyFromDate(isoDate));
}

export type ReferentialItemLike = {
  value?: string;
  meta?: { kind?: string };
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function effectiveSlotMinutes(config: PlatformConfig): number {
  const duration =
    config.defaultAppointmentDurationMinutes ?? config.slotDurationMinutes ?? 30;
  const buffer = config.bufferMinutes ?? 0;
  return duration + buffer;
}

export function isWeekendDay(key: WeekdayKey): boolean {
  return key === 'sat' || key === 'sun';
}

export function isDateOnWeekend(isoDate: string): boolean {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export function isHolidayDate(
  isoDate: string,
  holidays: ReferentialItemLike[]
): boolean {
  for (const h of holidays) {
    const meta = getHolidayMeta(h);
    if (!meta.active) continue;
    if (meta.date === isoDate) return true;
    if (meta.annualRepeat && meta.date.length >= 10) {
      const [, mm, dd] = meta.date.split('-');
      const [, qm, qd] = isoDate.split('-');
      if (mm === qm && dd === qd) return true;
    }
  }
  return false;
}

export function isWithinWorkingHours(
  config: PlatformConfig,
  time: string
): boolean {
  const t = timeToMinutes(time);
  return t >= timeToMinutes(config.workDayStart) && t <= timeToMinutes(config.workDayEnd);
}

export function overlapsUnavailability(
  unavailability: UnavailabilityMeta,
  date: string,
  startTime: string,
  endTime: string
): boolean {
  if (!unavailability.active) return false;
  if (date < unavailability.startDate || date > unavailability.endDate) return false;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const uStart = timeToMinutes(unavailability.startTime);
  const uEnd = timeToMinutes(unavailability.endTime);
  return start < uEnd && end > uStart;
}

export type AppointmentPolicyViolation =
  | 'DURATION_NOT_ALLOWED'
  | 'MAX_PER_DAY'
  | 'MAX_PER_WEEK'
  | 'OUTSIDE_HOURS'
  | 'WEEKEND_NOT_ALLOWED'
  | 'NON_WORKING_DAY'
  | 'HOLIDAY'
  | 'UNAVAILABLE';

export const APPOINTMENT_POLICY_MESSAGES: Record<AppointmentPolicyViolation, string> = {
  DURATION_NOT_ALLOWED: 'Cette durée de rendez-vous n’est pas autorisée.',
  MAX_PER_DAY: 'Le nombre maximal de rendez-vous par jour est atteint.',
  MAX_PER_WEEK: 'Le nombre maximal de rendez-vous par semaine est atteint.',
  OUTSIDE_HOURS: 'Les rendez-vous hors horaires du cabinet ne sont pas autorisés.',
  WEEKEND_NOT_ALLOWED: 'Les rendez-vous le week-end ne sont pas autorisés.',
  NON_WORKING_DAY: 'Cette date n’est pas un jour ouvré.',
  HOLIDAY: 'Cette date est un jour férié.',
  UNAVAILABLE: 'Le cabinet est indisponible sur ce créneau.',
};

export const DATE_POLICY_VIOLATIONS = new Set<AppointmentPolicyViolation>([
  'WEEKEND_NOT_ALLOWED',
  'NON_WORKING_DAY',
  'HOLIDAY',
  'UNAVAILABLE',
]);

export function isDatePolicyViolation(code: string): code is AppointmentPolicyViolation {
  return DATE_POLICY_VIOLATIONS.has(code as AppointmentPolicyViolation);
}

/** Contrôles référentiels applicables dès le choix de la date (jours ouvrés, fériés, week-end). */
export function validateDateAgainstReferentials(opts: {
  date: string;
  workingDays: WeekdayKey[];
  allowWeekendAppointments: boolean;
  holidays: ReferentialItemLike[];
}): Extract<
  AppointmentPolicyViolation,
  'HOLIDAY' | 'NON_WORKING_DAY' | 'WEEKEND_NOT_ALLOWED'
> | null {
  const { date, workingDays, allowWeekendAppointments, holidays } = opts;
  if (isHolidayDate(date, holidays)) return 'HOLIDAY';
  if (!isWorkingDayDate(date, workingDays)) return 'NON_WORKING_DAY';
  if (!allowWeekendAppointments && isDateOnWeekend(date)) return 'WEEKEND_NOT_ALLOWED';
  return null;
}

export function isDateBlockedByReferentials(
  isoDate: string,
  opts: {
    workingDays: WeekdayKey[];
    allowWeekendAppointments: boolean;
    holidays: ReferentialItemLike[];
  }
): boolean {
  return validateDateAgainstReferentials({ date: isoDate, ...opts }) !== null;
}

export function validateAppointmentAgainstPolicy(opts: {
  config: PlatformConfig;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  appointmentsOnDay: number;
  appointmentsOnWeek: number;
  holidays: ReferentialItemLike[];
  unavailabilities: UnavailabilityMeta[];
  allDay?: boolean;
  /** Réunion Teams : pas de contrainte jour ouvré / férié / week-end / indispo site. */
  isOnlineMeeting?: boolean;
  /**
   * Urgence justifiée le jour même : le férié, le week-end et l’indisponibilité
   * du jour ne bloquent plus la date. Les horaires restent.
   */
  ignoreDateBlocks?: boolean;
}): AppointmentPolicyViolation | null {
  const { config, date, startTime, endTime, allDay, isOnlineMeeting, ignoreDateBlocks } = opts;

  if (!isOnlineMeeting && !ignoreDateBlocks) {
    const dateViolation = validateDateAgainstReferentials({
      date,
      workingDays: config.workingDays,
      allowWeekendAppointments: config.allowWeekendAppointments,
      holidays: opts.holidays,
    });
    if (dateViolation) return dateViolation;
  }

  if (!isOnlineMeeting && !allDay && !config.allowOutsideHours) {
    if (!isWithinWorkingHours(config, startTime) || !isWithinWorkingHours(config, endTime)) {
      return 'OUTSIDE_HOURS';
    }
  }

  if (!isOnlineMeeting && !ignoreDateBlocks) {
    for (const u of opts.unavailabilities) {
      if (overlapsUnavailability(u, date, startTime, endTime)) {
        return 'UNAVAILABLE';
      }
    }
  }

  return null;
}
