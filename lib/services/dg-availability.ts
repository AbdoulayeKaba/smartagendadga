import { isSlotStartInThePast, parseDateTime, PAST_SLOT_MESSAGE } from '@/lib/dg/scheduling';
import {
  APPOINTMENT_POLICY_MESSAGES,
  isDateOnWeekend,
  isHolidayDate,
  overlapsUnavailability,
  type AppointmentPolicyViolation,
} from '@/lib/dg/scheduling-policy';
import type { WeekdayKey } from '@/lib/dg/platform-config';
import { getUnavailabilityMeta } from '@/lib/dg/referential-types';
import {
  blockedRangesAsUnavailabilityMeta,
  buildSchedulingBlockedRanges,
} from '@/lib/dg/appointment-scheduling-context';
import { timeToMinutes } from '@/lib/dg/schedule-capacity';
import { listAppointments } from '@/lib/services/appointments';
import { getPlatformSettings } from '@/lib/services/platform-settings';
import {
  listActiveHolidays,
  listActiveUnavailabilities,
  normalizeScheduleSettings,
} from '@/lib/services/referentials-admin';
import { listWorkspaceMissions } from '@/lib/services/workspace-service';

const WEEKDAY_FROM_DATE: Record<number, WeekdayKey> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

/** Grille d’affichage agenda DGA (indépendante des réglages salles). */
const DG_DISPLAY_SLOT_MINUTES = 30;

export type SlotStatus = 'AVAILABLE' | 'BUSY' | 'BUFFER' | 'BLOCKED';

export type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  status: SlotStatus;
  label?: string;
  reason?: string;
};

export type DgAvailabilityResult = {
  date: string;
  schedule: {
    workDayStart: string;
    workDayEnd: string;
    durationMinutes: number;
    maxPerDay: number;
  };
  daySummary: {
    isWorkingDay: boolean;
    isHoliday: boolean;
    policyBlock: AppointmentPolicyViolation | null;
    appointmentsCount: number;
    availableCount: number;
    busyCount: number;
  };
  slots: AvailabilitySlot[];
};

function minutesToTime(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function overlapsRange(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

export async function getDgAvailability(date: string): Promise<DgAvailabilityResult> {
  const config = await getPlatformSettings();
  const schedule = normalizeScheduleSettings(config);
  const holidays = await listActiveHolidays();
  const unavailabilityItems = await listActiveUnavailabilities();
  const unavailabilities = unavailabilityItems
    .map((i) => getUnavailabilityMeta(i))
    .filter((m): m is NonNullable<typeof m> => m !== null);
  const missions = await listWorkspaceMissions({ archived: false }).catch(() => []);
  const allUnavailabilities = [
    ...unavailabilities,
    ...blockedRangesAsUnavailabilityMeta(
      buildSchedulingBlockedRanges({ unavailabilities: [], missions })
    ),
  ];

  const duration = DG_DISPLAY_SLOT_MINUTES;

  const dayStart = parseDateTime(date, schedule.workDayStart);
  const dayEnd = parseDateTime(date, schedule.workDayEnd);
  const appointments = await listAppointments({
    status: 'APPROVED',
    from: dayStart,
    to: new Date(dayEnd.getTime() + 86400000),
  });

  const dayAppointments = appointments.filter((a) => a.startAt.toISOString().slice(0, 10) === date);

  const weekday = WEEKDAY_FROM_DATE[new Date(`${date}T12:00:00`).getDay()];
  const isWorkingDay = schedule.workingDays.includes(weekday);
  const isHoliday = isHolidayDate(date, holidays);

  let policyBlock: AppointmentPolicyViolation | null = null;
  if (!isWorkingDay) policyBlock = 'OUTSIDE_HOURS';
  else if (isHoliday) policyBlock = 'HOLIDAY';
  else if (isDateOnWeekend(date) && !schedule.allowWeekendAppointments) policyBlock = 'WEEKEND_NOT_ALLOWED';

  const workStart = timeToMinutes(schedule.workDayStart);
  const workEnd = timeToMinutes(schedule.workDayEnd);

  const slots: AvailabilitySlot[] = [];

  for (let cursor = workStart; cursor + duration <= workEnd; cursor += duration) {
    const startTime = minutesToTime(cursor);
    const endTime = minutesToTime(cursor + duration);

    if (isSlotStartInThePast(date, startTime)) {
      slots.push({
        startTime,
        endTime,
        status: 'BLOCKED',
        reason: PAST_SLOT_MESSAGE,
      });
      continue;
    }

    if (policyBlock) {
      slots.push({
        startTime,
        endTime,
        status: 'BLOCKED',
        reason: APPOINTMENT_POLICY_MESSAGES[policyBlock],
      });
      continue;
    }

    const blockedUnavail = allUnavailabilities.find((u) =>
      overlapsUnavailability(u, date, startTime, endTime)
    );
    if (blockedUnavail) {
      slots.push({
        startTime,
        endTime,
        status: 'BLOCKED',
        reason: blockedUnavail.motif ?? 'Indisponibilité DGA',
      });
      continue;
    }

    const slotStartDate = parseDateTime(date, startTime);
    const slotEndDate = parseDateTime(date, endTime);
    const busyAppt = dayAppointments.find((a) => {
      const aStart = a.startAt.getTime();
      const aEnd = a.endAt.getTime();
      return overlapsRange(slotStartDate.getTime(), slotEndDate.getTime(), aStart, aEnd);
    });

    if (busyAppt) {
      slots.push({
        startTime,
        endTime,
        status: 'BUSY',
        label: busyAppt.title,
        reason: 'Créneau occupé',
      });
      continue;
    }

    slots.push({ startTime, endTime, status: 'AVAILABLE' });
  }

  const availableCount = slots.filter((s) => s.status === 'AVAILABLE').length;
  const busyCount = slots.filter((s) => s.status === 'BUSY').length;

  return {
    date,
    schedule: {
      workDayStart: schedule.workDayStart,
      workDayEnd: schedule.workDayEnd,
      durationMinutes: duration,
      maxPerDay: schedule.maxAppointmentsPerDay,
    },
    daySummary: {
      isWorkingDay,
      isHoliday,
      policyBlock,
      appointmentsCount: dayAppointments.length,
      availableCount,
      busyCount,
    },
    slots,
  };
}

export type DgAvailabilityDaySummary = {
  date: string;
  weekdayLabel: string;
  availableCount: number;
  busyCount: number;
  blockedCount: number;
  totalSlots: number;
  appointmentsCount: number;
  policyBlock: AppointmentPolicyViolation | null;
  isWorkingDay: boolean;
};

function addDaysIso(date: string, delta: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

const WEEKDAY_LABELS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export async function getDgAvailabilityWeekSummary(anchorDate: string) {
  const days: DgAvailabilityDaySummary[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(anchorDate, i);
    const result = await getDgAvailability(date);
    const dow = new Date(`${date}T12:00:00`).getDay();
    const blockedCount = result.slots.filter((s) => s.status === 'BLOCKED').length;
    days.push({
      date,
      weekdayLabel: WEEKDAY_LABELS_FR[dow] ?? '',
      availableCount: result.daySummary.availableCount,
      busyCount: result.daySummary.busyCount,
      blockedCount,
      totalSlots: result.slots.length,
      appointmentsCount: result.daySummary.appointmentsCount,
      policyBlock: result.daySummary.policyBlock,
      isWorkingDay: result.daySummary.isWorkingDay,
    });
  }
  return { anchor: anchorDate, days };
}
