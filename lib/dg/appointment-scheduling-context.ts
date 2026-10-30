import { format } from 'date-fns';
import type { WeekdayKey } from '@/lib/dg/platform-config';
import { DEFAULT_PLATFORM_CONFIG } from '@/lib/dg/platform-config';
import type { HolidayType, UnavailabilityMeta } from '@/lib/dg/referential-types';
import { isMissionBlockingApproval } from '@/lib/workspace/mission-visual-state';
import {
  APPOINTMENT_POLICY_MESSAGES,
  isDateBlockedByReferentials,
  validateDateAgainstReferentials,
  type ReferentialItemLike,
} from '@/lib/dg/scheduling-policy';

export type SchedulingHoliday = {
  date: string;
  annualRepeat: boolean;
  active: boolean;
  type?: HolidayType;
};

/** Plage où le DGA n’est pas disponible pour un RDV (mission ou indispo référentiel). */
export type SchedulingBlockedRange = {
  startDate: string;
  endDate: string;
  source: 'mission' | 'unavailability';
  label?: string;
};

export type AppointmentSchedulingContext = {
  workingDays: WeekdayKey[];
  allowWeekendAppointments: boolean;
  workDayStart: string;
  workDayEnd: string;
  allowOutsideHours: boolean;
  holidays: SchedulingHoliday[];
  blockedRanges: SchedulingBlockedRange[];
};

export const DEFAULT_SCHEDULING_CONTEXT: AppointmentSchedulingContext = {
  workingDays: DEFAULT_PLATFORM_CONFIG.workingDays,
  allowWeekendAppointments: DEFAULT_PLATFORM_CONFIG.allowWeekendAppointments,
  workDayStart: DEFAULT_PLATFORM_CONFIG.workDayStart,
  workDayEnd: DEFAULT_PLATFORM_CONFIG.workDayEnd,
  allowOutsideHours: DEFAULT_PLATFORM_CONFIG.allowOutsideHours,
  holidays: [],
  blockedRanges: [],
};

function toHolidayReferentialItems(holidays: SchedulingHoliday[]): ReferentialItemLike[] {
  return holidays
    .filter((h) => h.active)
    .map((h) => ({
      value: h.date,
      meta: {
        kind: 'holiday' as const,
        date: h.date,
        type: h.type ?? ('national' as HolidayType),
        annualRepeat: h.annualRepeat,
        active: h.active,
      },
    }));
}

function isoDateKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
}

export function isIsoDateInBlockedRange(isoDate: string, range: SchedulingBlockedRange): boolean {
  if (!isoDate || !range.startDate || !range.endDate) return false;
  return isoDate >= range.startDate && isoDate <= range.endDate;
}

export function findSchedulingBlockedRange(
  isoDate: string,
  ranges: SchedulingBlockedRange[]
): SchedulingBlockedRange | null {
  return ranges.find((range) => isIsoDateInBlockedRange(isoDate, range)) ?? null;
}

export function buildSchedulingBlockedRanges(input: {
  unavailabilities: UnavailabilityMeta[];
  missions: {
    departAt: string | Date;
    returnAt: string | Date;
    status: string;
    subject?: string;
    archived?: boolean;
  }[];
  now?: Date;
}): SchedulingBlockedRange[] {
  const now = input.now ?? new Date();
  const ranges: SchedulingBlockedRange[] = [];

  for (const u of input.unavailabilities) {
    if (!u.active) continue;
    if (!u.startDate || !u.endDate) continue;
    ranges.push({
      startDate: u.startDate,
      endDate: u.endDate,
      source: 'unavailability',
      label: u.motif?.trim() || undefined,
    });
  }

  for (const mission of input.missions) {
    if (mission.archived) continue;
    if (mission.status === 'CANCELLED' || mission.status === 'COMPLETED') continue;
    let startDate = isoDateKey(mission.departAt);
    const endDate = isoDateKey(mission.returnAt);
    if (!startDate || !endDate || startDate > endDate) continue;
    const ongoing = isMissionBlockingApproval(
      {
        status: mission.status as 'PLANNED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED',
        departAt: mission.departAt,
        returnAt: mission.returnAt,
        archived: mission.archived,
      },
      now
    );
    if (!ongoing) continue;
    ranges.push({
      startDate,
      endDate,
      source: 'mission',
      label: mission.subject?.trim() || undefined,
    });
  }

  return ranges;
}

export function blockedRangeMessage(range: SchedulingBlockedRange): string {
  if (range.source === 'mission') {
    return range.label?.trim()
      ? `Le DGA est en mission (« ${range.label.trim()} ») à cette date.`
      : 'Le DGA est en mission à cette date.';
  }
  return range.label?.trim()
    ? `Le DGA est indisponible à cette date (${range.label.trim()}).`
    : 'Le DGA est indisponible à cette date (congés ou blocage du référentiel).';
}

/** Convertit les plages bloquées en indispos journée entière pour la politique de créneaux. */
export function blockedRangesAsUnavailabilityMeta(
  ranges: SchedulingBlockedRange[]
): UnavailabilityMeta[] {
  return ranges.map((range) => ({
    kind: 'unavailability' as const,
    type: range.source === 'mission' ? ('mission' as const) : ('conge' as const),
    startDate: range.startDate,
    endDate: range.endDate,
    startTime: '00:00',
    endTime: '23:59',
    motif: range.label?.trim() || (range.source === 'mission' ? 'Mission DGA' : 'Indisponibilité DGA'),
    confidentialityLevel: 'standard' as const,
    active: true,
  }));
}

export function normalizeSchedulingContext(
  raw: Partial<AppointmentSchedulingContext> | null | undefined
): AppointmentSchedulingContext {
  if (!raw) return { ...DEFAULT_SCHEDULING_CONTEXT };
  return {
    ...DEFAULT_SCHEDULING_CONTEXT,
    ...raw,
    workingDays: raw.workingDays?.length ? raw.workingDays : DEFAULT_SCHEDULING_CONTEXT.workingDays,
    holidays: raw.holidays ?? [],
    blockedRanges: raw.blockedRanges ?? [],
  };
}

function rangesBlockingPlanning(ranges: SchedulingBlockedRange[]): SchedulingBlockedRange[] {
  return ranges.filter((range) => range.source !== 'mission');
}

export function validatePlanningDate(
  ctx: AppointmentSchedulingContext,
  isoDate: string,
  opts?: { isOnlineMeeting?: boolean }
): string | null {
  if (!isoDate) return null;
  // RDV en ligne (Teams) : toutes les dates sont ouvertes (hors délai R1 géré à part).
  if (opts?.isOnlineMeeting) return null;

  const violation = validateDateAgainstReferentials({
    date: isoDate,
    workingDays: ctx.workingDays,
    allowWeekendAppointments: ctx.allowWeekendAppointments,
    holidays: toHolidayReferentialItems(ctx.holidays),
  });
  if (violation) return APPOINTMENT_POLICY_MESSAGES[violation];

  const blocked = findSchedulingBlockedRange(isoDate, rangesBlockingPlanning(ctx.blockedRanges));
  return blocked ? blockedRangeMessage(blocked) : null;
}

export function isPlanningDateBlocked(
  ctx: AppointmentSchedulingContext,
  isoDate: string,
  opts?: { isOnlineMeeting?: boolean }
): boolean {
  if (!isoDate) return false;
  if (opts?.isOnlineMeeting) return false;
  if (
    isDateBlockedByReferentials(isoDate, {
      workingDays: ctx.workingDays,
      allowWeekendAppointments: ctx.allowWeekendAppointments,
      holidays: toHolidayReferentialItems(ctx.holidays),
    })
  ) {
    return true;
  }
  return findSchedulingBlockedRange(isoDate, rangesBlockingPlanning(ctx.blockedRanges)) != null;
}
