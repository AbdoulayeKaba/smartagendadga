import { addDays, format } from 'date-fns';
import {
  getHolidayMeta,
  getUnavailabilityMeta,
  unavailabilityTypeLabel,
  type UnavailabilityType,
} from '@/lib/dg/referential-types';
import {
  listActiveHolidays,
  listActiveUnavailabilities,
} from '@/lib/services/referentials-admin';
import { runAutoMissionStatusTransitions } from '@/lib/services/mission-workflow';
import { listWorkspaceMissions } from '@/lib/services/workspace-service';

export type SyncUnavailabilityTypeCount = {
  type: UnavailabilityType | string;
  label: string;
  /** Entrées référentiel actives dans la période. */
  items: number;
  /** Jours d’overlay générés dans la période. */
  days: number;
};

export type DgCalendarSyncResult = {
  transitions: {
    plannedToOngoing: number;
    ongoingToCompleted: number;
  };
  missions: {
    /** Missions agenda (PLANIFIÉ + EN COURS + TERMINÉ) qui chevauchent la période. */
    total: number;
    planned: number;
    ongoing: number;
    completed: number;
    /** Jours d’overlay mission dans la période. */
    days: number;
    daysPlanned: number;
    daysOngoing: number;
    daysCompleted: number;
  };
  unavailabilities: {
    /** Entrées référentiel actives qui chevauchent la période. */
    total: number;
    /** Jours d’overlay indispo/congé dans la période. */
    days: number;
    byType: SyncUnavailabilityTypeCount[];
  };
  holidays: {
    items: number;
    days: number;
  };
  overlays: {
    missions: number;
    unavailabilities: number;
    holidays: number;
    total: number;
  };
};

function dateKey(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aEnd >= bStart && aStart <= bEnd;
}

function daysBetweenInclusive(start: string, end: string): number {
  if (end < start) return 0;
  const from = new Date(`${start}T12:00:00`);
  const to = new Date(`${end}T12:00:00`);
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
}

/**
 * Aligne l’agenda DGA sur les sources métier et renvoie un bilan détaillé.
 */
export async function syncDgCalendarOverlays(
  from: Date,
  toExclusive: Date
): Promise<DgCalendarSyncResult> {
  const transitions = await runAutoMissionStatusTransitions().catch(() => ({
    plannedToOngoing: 0,
    ongoingToCompleted: 0,
  }));

  const [holidays, unavailabilities, missions] = await Promise.all([
    listActiveHolidays(),
    listActiveUnavailabilities(),
    listWorkspaceMissions({ archived: false }),
  ]);

  const rangeStart = dateKey(from);
  const rangeEnd = dateKey(addDays(toExclusive, -1));

  let missionTotal = 0;
  let missionPlanned = 0;
  let missionOngoing = 0;
  let missionCompleted = 0;
  let missionDays = 0;
  let missionDaysPlanned = 0;
  let missionDaysOngoing = 0;
  let missionDaysCompleted = 0;

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
    if (!rangesOverlap(departKey, returnKey, rangeStart, rangeEnd)) continue;

    const spanStart = departKey < rangeStart ? rangeStart : departKey;
    const spanEnd = returnKey > rangeEnd ? rangeEnd : returnKey;
    const days = daysBetweenInclusive(spanStart, spanEnd);

    missionTotal += 1;
    missionDays += days;
    if (mission.status === 'PLANNED') {
      missionPlanned += 1;
      missionDaysPlanned += days;
    } else if (mission.status === 'ONGOING') {
      missionOngoing += 1;
      missionDaysOngoing += days;
    } else {
      missionCompleted += 1;
      missionDaysCompleted += days;
    }
  }

  const typeMap = new Map<
    string,
    { type: UnavailabilityType | string; label: string; items: number; days: number }
  >();
  let unavItems = 0;
  let unavDays = 0;

  for (const item of unavailabilities) {
    const meta = getUnavailabilityMeta(item);
    if (!meta?.active) continue;
    if (!rangesOverlap(meta.startDate, meta.endDate, rangeStart, rangeEnd)) continue;

    const spanStart = meta.startDate < rangeStart ? rangeStart : meta.startDate;
    const spanEnd = meta.endDate > rangeEnd ? rangeEnd : meta.endDate;
    const days = daysBetweenInclusive(spanStart, spanEnd);
    const label = unavailabilityTypeLabel(meta.type, meta.typeOther);
    const key = meta.type === 'autres' && meta.typeOther?.trim()
      ? `autres:${meta.typeOther.trim().toLowerCase()}`
      : meta.type;

    const prev = typeMap.get(key) ?? { type: meta.type, label, items: 0, days: 0 };
    prev.items += 1;
    prev.days += days;
    typeMap.set(key, prev);

    unavItems += 1;
    unavDays += days;
  }

  const byType = [...typeMap.values()].sort((a, b) => b.items - a.items || b.days - a.days);

  let holidayItems = 0;
  let holidayDays = 0;
  for (const item of holidays) {
    const meta = getHolidayMeta(item);
    if (!meta.active) continue;

    // Compte les occurrences dans la période (répétition annuelle incluse).
    let matches = 0;
    for (
      let cursor = new Date(`${rangeStart}T12:00:00`);
      cursor <= new Date(`${rangeEnd}T12:00:00`);
      cursor = addDays(cursor, 1)
    ) {
      const key = dateKey(cursor);
      let match = meta.date === key;
      if (!match && meta.annualRepeat && meta.date.length >= 10) {
        const [, mm, dd] = meta.date.split('-');
        const [, qm, qd] = key.split('-');
        match = mm === qm && dd === qd;
      }
      if (match) matches += 1;
    }
    if (matches === 0) continue;
    holidayItems += 1;
    holidayDays += matches;
  }

  return {
    transitions,
    missions: {
      total: missionTotal,
      planned: missionPlanned,
      ongoing: missionOngoing,
      completed: missionCompleted,
      days: missionDays,
      daysPlanned: missionDaysPlanned,
      daysOngoing: missionDaysOngoing,
      daysCompleted: missionDaysCompleted,
    },
    unavailabilities: {
      total: unavItems,
      days: unavDays,
      byType,
    },
    holidays: {
      items: holidayItems,
      days: holidayDays,
    },
    overlays: {
      missions: missionDays,
      unavailabilities: unavDays,
      holidays: holidayDays,
      total: missionDays + unavDays + holidayDays,
    },
  };
}
