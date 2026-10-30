import { formatIsoDateInAppTz, formatTimeInAppTz } from '@/lib/datetime';
import { rangesConflict } from '@/lib/dg/scheduling';
import type { DailyAgendaConflict } from '@/lib/ai/types';

export type AgendaConflictItem = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  requester: string;
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function normalizeItem(item: AgendaConflictItem): AgendaConflictItem {
  return {
    ...item,
    startAt: asDate(item.startAt),
    endAt: asDate(item.endAt),
  };
}

function slotLabel(start: Date, end: Date) {
  return `${formatTimeInAppTz(start)} – ${formatTimeInAppTz(end)}`;
}

function startKey(item: AgendaConflictItem) {
  return `${formatIsoDateInAppTz(item.startAt)}@${formatTimeInAppTz(item.startAt)}`;
}

function buildConflictMessage(
  a: AgendaConflictItem,
  b: AgendaConflictItem,
  sameStart: boolean,
  timeLabel: string
) {
  if (sameStart) {
    return `Deux RDV commencent à ${formatTimeInAppTz(a.startAt)} : « ${a.title} » et « ${b.title} ».`;
  }
  return `Chevauchement ${timeLabel} : « ${a.title} » (${slotLabel(a.startAt, a.endAt)}) et « ${b.title} » (${slotLabel(b.startAt, b.endAt)}).`;
}

function pushConflict(
  conflicts: DailyAgendaConflict[],
  pairKeys: Set<string>,
  a: AgendaConflictItem,
  b: AgendaConflictItem,
  sameStart: boolean
) {
  const pairId = [a.id, b.id].sort().join('::');
  if (pairKeys.has(pairId)) return;
  pairKeys.add(pairId);

  const overlapStart = new Date(Math.max(a.startAt.getTime(), b.startAt.getTime()));
  const overlapEnd = new Date(Math.min(a.endAt.getTime(), b.endAt.getTime()));
  const timeLabel = sameStart
    ? `début à ${formatTimeInAppTz(a.startAt)}`
    : slotLabel(overlapStart, overlapEnd);

  conflicts.push({
    id: pairId,
    timeLabel,
    sameStart,
    appointmentIds: [a.id, b.id],
    items: [
      { id: a.id, title: a.title, time: slotLabel(a.startAt, a.endAt), requester: a.requester },
      { id: b.id, title: b.title, time: slotLabel(b.startAt, b.endAt), requester: b.requester },
    ],
    message: buildConflictMessage(a, b, sameStart, timeLabel),
  });
}

/**
 * Détecte les chevauchements et les horaires de début identiques
 * (fuseau institutionnel) entre RDV confirmés du jour.
 */
export function detectDailyAgendaConflicts(items: AgendaConflictItem[]): DailyAgendaConflict[] {
  const normalized = items.map(normalizeItem);
  if (normalized.length < 2) return [];

  const conflicts: DailyAgendaConflict[] = [];
  const pairKeys = new Set<string>();

  const byStart = new Map<string, AgendaConflictItem[]>();
  for (const item of normalized) {
    const key = startKey(item);
    const group = byStart.get(key) ?? [];
    group.push(item);
    byStart.set(key, group);
  }

  for (const group of byStart.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pushConflict(conflicts, pairKeys, group[i]!, group[j]!, true);
      }
    }
  }

  const sorted = [...normalized].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      if (b.startAt.getTime() >= a.endAt.getTime()) break;
      if (!rangesConflict(a, b, 0)) continue;
      const sameStart = startKey(a) === startKey(b);
      pushConflict(conflicts, pairKeys, a, b, sameStart);
    }
  }

  return conflicts;
}

export function formatAgendaConflictSummary(conflicts: DailyAgendaConflict[]): string[] {
  return conflicts.map((c) => c.message);
}

export type DisplayAgendaConflictItem = {
  id: string;
  title: string;
  time: string;
  requester: string;
};

function parseDisplayMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseDisplayRange(time: string) {
  const [startRaw, endRaw] = time.split(/\s*[–-]\s*/);
  const startMin = parseDisplayMinutes(startRaw ?? '');
  const endMin = parseDisplayMinutes(endRaw ?? '');
  if (startMin === null || endMin === null) return null;
  return { startMin, endMin: Math.max(endMin, startMin + 1) };
}

function displayRangesOverlap(
  a: { startMin: number; endMin: number },
  b: { startMin: number; endMin: number }
) {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function slotLabelFromDisplay(time: string) {
  return time.replace(/\s+/g, ' ').trim();
}

/** Détection par horaires affichés (HH:mm – HH:mm) — alignée sur la timeline UI. */
export function detectConflictsFromDisplayTimes(
  items: DisplayAgendaConflictItem[]
): DailyAgendaConflict[] {
  const parsed = items
    .map((item) => {
      const range = parseDisplayRange(item.time);
      if (!range) return null;
      return { item, range };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (parsed.length < 2) return [];

  const conflicts: DailyAgendaConflict[] = [];
  const pairKeys = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    const a = parsed[i]!;
    for (let j = i + 1; j < parsed.length; j++) {
      const b = parsed[j]!;
      if (!displayRangesOverlap(a.range, b.range)) continue;

      const pairId = [a.item.id, b.item.id].sort().join('::');
      if (pairKeys.has(pairId)) continue;
      pairKeys.add(pairId);

      const sameStart = a.range.startMin === b.range.startMin;
      const overlapStartMin = Math.max(a.range.startMin, b.range.startMin);
      const overlapEndMin = Math.min(a.range.endMin, b.range.endMin);
      const fmt = (min: number) =>
        `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
      const timeLabel = sameStart
        ? `début à ${fmt(a.range.startMin)}`
        : `${fmt(overlapStartMin)} – ${fmt(overlapEndMin)}`;

      const message = sameStart
        ? `Deux RDV commencent à ${fmt(a.range.startMin)} : « ${a.item.title} » et « ${b.item.title} ».`
        : `Chevauchement ${timeLabel} : « ${a.item.title} » (${slotLabelFromDisplay(a.item.time)}) et « ${b.item.title} » (${slotLabelFromDisplay(b.item.time)}).`;

      conflicts.push({
        id: pairId,
        timeLabel,
        sameStart,
        appointmentIds: [a.item.id, b.item.id],
        items: [
          {
            id: a.item.id,
            title: a.item.title,
            time: slotLabelFromDisplay(a.item.time),
            requester: a.item.requester,
          },
          {
            id: b.item.id,
            title: b.item.title,
            time: slotLabelFromDisplay(b.item.time),
            requester: b.item.requester,
          },
        ],
        message,
      });
    }
  }

  return conflicts;
}

export function mergeAgendaConflicts(...lists: DailyAgendaConflict[][]): DailyAgendaConflict[] {
  const merged: DailyAgendaConflict[] = [];
  const pairKeys = new Set<string>();
  for (const list of lists) {
    for (const conflict of list) {
      const pairId = [...conflict.appointmentIds].sort().join('::');
      if (pairKeys.has(pairId)) continue;
      pairKeys.add(pairId);
      merged.push(conflict);
    }
  }
  return merged;
}
