import { addDays, eachDayOfInterval, format } from 'date-fns';
import {
  getHolidayMeta,
  getUnavailabilityMeta,
  holidayTypeLabel,
  unavailabilityTypeLabel,
  type ReferentialItemMeta,
} from '@/lib/dg/referential-types';
import {
  resolveMissionCalendarVisualState,
  type MissionVisualState,
} from '@/lib/workspace/mission-visual-state';
import type { DgMission } from '@/lib/workspace/types';

type ReferentialItemInput = {
  id: string;
  name: string;
  value?: string;
  meta?: ReferentialItemMeta;
};

export type CalendarOverlayKind =
  | 'holiday'
  | 'unavailability'
  | 'mission-planned'
  | 'mission-depart-today'
  | 'mission-ongoing'
  | 'mission-completed'
  | 'mission-cancelled';

export type CalendarOverlayEvent = {
  id: string;
  kind: CalendarOverlayKind;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  visualState?: MissionVisualState;
};

function dateKey(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function isoLocal(date: string, time: string) {
  return `${date}T${time}:00`;
}

function daysInRange(from: Date, toExclusive: Date) {
  const end = addDays(toExclusive, -1);
  if (end < from) return [];
  return eachDayOfInterval({ start: from, end });
}

export function buildHolidayOverlays(
  items: ReferentialItemInput[],
  from: Date,
  toExclusive: Date
): CalendarOverlayEvent[] {
  const events: CalendarOverlayEvent[] = [];
  const days = daysInRange(from, toExclusive);

  for (const item of items) {
    const meta = getHolidayMeta(item);
    if (!meta.active) continue;

    for (const day of days) {
      const key = dateKey(day);
      let match = meta.date === key;
      if (!match && meta.annualRepeat && meta.date.length >= 10) {
        const [, mm, dd] = meta.date.split('-');
        const [, qm, qd] = key.split('-');
        match = mm === qm && dd === qd;
      }
      if (!match) continue;

      events.push({
        id: `holiday-${item.id}-${key}`,
        kind: 'holiday',
        title: `${item.name} (${holidayTypeLabel(meta.type)})`,
        startAt: isoLocal(key, '00:00'),
        endAt: isoLocal(key, '23:59'),
        allDay: true,
      });
    }
  }

  return events;
}

export function buildUnavailabilityOverlays(
  items: ReferentialItemInput[],
  from: Date,
  toExclusive: Date
): CalendarOverlayEvent[] {
  const events: CalendarOverlayEvent[] = [];
  const rangeStart = dateKey(from);
  const rangeEnd = dateKey(addDays(toExclusive, -1));

  for (const item of items) {
    const meta = getUnavailabilityMeta(item);
    if (!meta?.active) continue;
    if (meta.endDate < rangeStart || meta.startDate > rangeEnd) continue;

    const start = meta.startDate < rangeStart ? rangeStart : meta.startDate;
    const end = meta.endDate > rangeEnd ? rangeEnd : meta.endDate;
    const days = eachDayOfInterval({
      start: new Date(`${start}T12:00:00`),
      end: new Date(`${end}T12:00:00`),
    });

    const typeLabel = unavailabilityTypeLabel(meta.type, meta.typeOther);

    for (const day of days) {
      const key = dateKey(day);
      events.push({
        id: `unav-${item.id}-${key}`,
        kind: 'unavailability',
        title: `${item.name} · ${typeLabel}`,
        startAt: isoLocal(key, meta.startTime),
        endAt: isoLocal(key, meta.endTime),
        allDay: meta.startTime === '00:00' && meta.endTime === '23:59',
      });
    }
  }

  return events;
}

export function buildMissionOverlays(
  missions: DgMission[],
  from: Date,
  toExclusive: Date
): CalendarOverlayEvent[] {
  const events: CalendarOverlayEvent[] = [];
  const rangeStart = dateKey(from);
  const rangeEnd = dateKey(addDays(toExclusive, -1));

  // Agenda DGA : missions PLANIFIÉES, EN COURS et TERMINÉES (pas ANNULÉ).
  for (const mission of missions) {
    if (mission.archived) continue;
    if (
      mission.status !== 'PLANNED' &&
      mission.status !== 'ONGOING' &&
      mission.status !== 'COMPLETED'
    ) {
      continue;
    }

    const departKey = dateKey(new Date(mission.departAt));
    const returnKey = dateKey(new Date(mission.returnAt));
    const spanStart = departKey < rangeStart ? rangeStart : departKey;
    const spanEnd = returnKey > rangeEnd ? rangeEnd : returnKey;
    if (spanStart > spanEnd) continue;

    const days = eachDayOfInterval({
      start: new Date(`${spanStart}T12:00:00`),
      end: new Date(`${spanEnd}T12:00:00`),
    });

    const isCompleted = mission.status === 'COMPLETED';
    const isOngoing = mission.status === 'ONGOING';

    for (const day of days) {
      const key = dateKey(day);
      const visual = resolveMissionCalendarVisualState(mission, day);
      if (visual === 'CANCELLED') continue;
      // Mission encore EN COURS : ne pas peindre après la date de retour.
      if (isOngoing && visual === 'COMPLETED') continue;

      let kind: CalendarOverlayKind;
      if (isCompleted) {
        kind = 'mission-completed';
      } else if (visual === 'DEPART_TODAY') {
        kind = 'mission-depart-today';
      } else if (isOngoing) {
        kind = 'mission-ongoing';
      } else {
        kind = 'mission-planned';
      }

      events.push({
        id: `mission-${mission.id}-${key}`,
        kind,
        title:
          isCompleted && key === returnKey
            ? `Retour — ${mission.subject}`
            : mission.subject,
        startAt: isoLocal(key, '00:00'),
        endAt: isoLocal(key, '23:59'),
        allDay: true,
        visualState: visual,
      });
    }
  }

  return events;
}

export function mergeCalendarOverlayEvents(
  holidays: ReferentialItemInput[],
  unavailabilities: ReferentialItemInput[],
  missions: DgMission[],
  from: Date,
  toExclusive: Date
): CalendarOverlayEvent[] {
  return [
    ...buildHolidayOverlays(holidays, from, toExclusive),
    ...buildUnavailabilityOverlays(unavailabilities, from, toExclusive),
    ...buildMissionOverlays(missions, from, toExclusive),
  ].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}
