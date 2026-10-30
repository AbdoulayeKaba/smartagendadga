import type { DailyAgendaConflict, DailyAgendaResult } from '@/lib/ai/types';
import {
  detectConflictsFromDisplayTimes,
  detectDailyAgendaConflicts,
  formatAgendaConflictSummary,
  mergeAgendaConflicts,
} from '@/lib/ai/agenda-conflicts';

function buildConflictedIds(conflicts: DailyAgendaConflict[]) {
  const ids = new Set<string>();
  for (const c of conflicts) {
    for (const id of c.appointmentIds) ids.add(id);
  }
  return ids;
}

function mergeConflictHighlights(highlights: string[], conflicts: DailyAgendaConflict[]) {
  if (conflicts.length === 0) return highlights;

  const conflictTexts = new Set([
    `⚠ ${conflicts.length} conflit${conflicts.length > 1 ? 's' : ''} d'agenda — reprogrammer ou arbitrer.`,
    ...formatAgendaConflictSummary(conflicts),
  ]);

  const filtered = highlights.filter(
    (h) =>
      !h.startsWith('⚠') &&
      !h.toLowerCase().includes('conflit') &&
      !h.includes('Chevauchement') &&
      !h.includes('RDV commencent')
  );

  return [...conflictTexts, ...filtered];
}

/** Fusionne détection par dates et par horaires affichés, puis met à jour le résultat. */
export function enrichDailyAgendaResult(
  result: DailyAgendaResult,
  approvedToday?: {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    requester: string;
  }[]
): DailyAgendaResult {
  const fromDates = approvedToday?.length
    ? detectDailyAgendaConflicts(approvedToday)
    : result.conflicts;
  const fromDisplay = detectConflictsFromDisplayTimes(
    result.agendaItems.map((item) => ({
      id: item.id,
      title: item.title,
      time: item.time,
      requester: item.requester,
    }))
  );
  const conflicts = mergeAgendaConflicts(fromDates, fromDisplay, result.conflicts);
  const conflictedIds = buildConflictedIds(conflicts);
  const completedOrPast =
    approvedToday?.length != null
      ? approvedToday.filter((a) => a.endAt.getTime() < Date.now()).length
      : (result.stats.completedOrPast ?? 0);

  return {
    ...result,
    conflicts,
    highlights: mergeConflictHighlights(result.highlights, conflicts),
    agendaItems: result.agendaItems.map((item) => ({
      ...item,
      conflict: conflictedIds.has(item.id),
    })),
    stats: {
      ...result.stats,
      completedOrPast,
      conflicts: conflicts.length,
    },
  };
}
