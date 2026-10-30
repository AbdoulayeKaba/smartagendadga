import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { completeChat, parseJsonFromLlm } from '@/lib/ai/client';
import {
  buildAssistantAiContext,
  contextToPromptPayload,
  formatAgendaTimeRange,
} from '@/lib/ai/context';
import type { AiGenerationResult, DailyAgendaResult } from '@/lib/ai/types';
import {
  detectDailyAgendaConflicts,
  detectConflictsFromDisplayTimes,
  formatAgendaConflictSummary,
  mergeAgendaConflicts,
} from '@/lib/ai/agenda-conflicts';
import { enrichDailyAgendaResult } from '@/lib/ai/enrich-daily-agenda';

function buildConflictedIds(conflicts: DailyAgendaResult['conflicts']) {
  const ids = new Set<string>();
  for (const c of conflicts) {
    for (const id of c.appointmentIds) ids.add(id);
  }
  return ids;
}

function fallbackDailyAgenda(ctx: Awaited<ReturnType<typeof buildAssistantAiContext>>): DailyAgendaResult {
  const agendaItemsBase = ctx.approvedToday.map((a) => ({
    id: a.id,
    time: formatAgendaTimeRange(a.startAt, a.endAt),
    title: a.title,
    requester: a.requester,
    priority: a.priority,
    urgencyLabel: a.urgencyLabel,
    urgentOverride: a.urgentOverride,
    conflict: false,
  }));

  const conflicts = mergeAgendaConflicts(
    detectDailyAgendaConflicts(ctx.approvedToday),
    detectConflictsFromDisplayTimes(agendaItemsBase)
  );
  const conflictedIds = buildConflictedIds(conflicts);

  const highlights: string[] = [];

  if (conflicts.length > 0) {
    highlights.push(
      `⚠ ${conflicts.length} conflit${conflicts.length > 1 ? 's' : ''} d'agenda — reprogrammer ou arbitrer.`
    );
    highlights.push(...formatAgendaConflictSummary(conflicts));
  }

  if (ctx.approvedToday.length === 0) {
    highlights.push("Aucun rendez-vous confirmé aujourd'hui — créneaux disponibles pour le DGA.");
  } else if (conflicts.length === 0) {
    highlights.push(
      `${ctx.approvedToday.length} rendez-vous confirmé${ctx.approvedToday.length > 1 ? 's' : ''} aujourd'hui.`
    );
  }

  if (ctx.stats.pendingCount > 0) {
    highlights.push(
      `${ctx.stats.pendingCount} demande${ctx.stats.pendingCount > 1 ? 's' : ''} en attente de validation.`
    );
  }

  if (ctx.stats.highPriorityPending > 0) {
    highlights.push(
      `${ctx.stats.highPriorityPending} demande${ctx.stats.highPriorityPending > 1 ? 's' : ''} haute priorité à traiter.`
    );
  }

  if (ctx.tomorrowUrgent.length > 0) {
    highlights.push(
      `${ctx.tomorrowUrgent.length} RDV ultra urgent${ctx.tomorrowUrgent.length > 1 ? 's' : ''} demain.`
    );
  }

  if (ctx.stats.roomReservationsToday > 0) {
    highlights.push(`${ctx.stats.roomReservationsToday} réservation(s) de salle aujourd'hui.`);
  }

  const agendaLines = ctx.approvedToday.map((a) => {
    const time = formatAgendaTimeRange(a.startAt, a.endAt);
    const flags = [
      conflictedIds.has(a.id) ? '⚠ conflit' : null,
      a.urgentOverride ? 'ultra urgent' : null,
      a.urgencyLabel !== 'Normal' ? a.urgencyLabel : null,
    ]
      .filter(Boolean)
      .join(', ');
    return `• ${time} — ${a.title} (${a.requester}${flags ? ` · ${flags}` : ''})`;
  });

  const conflictLines = conflicts.map((c) => `• ${c.message}`);

  const pendingLines = ctx.pending.slice(0, 5).map(
    (p) => `• ${p.title} — créneau ${p.startAt.toLocaleString('fr-FR')} (${p.requester}, ${p.urgencyLabel})`
  );

  const briefing = [
    `Briefing du ${ctx.todayLabel}`,
    '',
    ...(conflicts.length > 0
      ? ['## ⚠ Conflits d\'agenda', conflictLines.join('\n'), '']
      : []),
    '## Agenda confirmé',
    agendaLines.length > 0 ? agendaLines.join('\n') : '— Aucun rendez-vous confirmé.',
    '',
    '## File d\'attente',
    pendingLines.length > 0 ? pendingLines.join('\n') : '— Aucune demande en attente.',
    '',
    '## Recommandations',
    ...highlights.map((h) => `• ${h}`),
  ].join('\n');

  const pendingItems = ctx.pending.slice(0, 6).map((p) => ({
    title: p.title,
    slot: format(p.startAt, 'EEE d MMM · HH:mm', { locale: fr }),
    requester: p.requester,
    urgencyLabel: p.urgencyLabel,
    priority: p.priority,
  }));

  const stats = {
    approvedToday: ctx.approvedToday.length,
    completedOrPast: ctx.approvedToday.filter((a) => a.endAt.getTime() < ctx.now.getTime()).length,
    pendingQueue: ctx.stats.pendingCount,
    conflicts: conflicts.length,
    highPriorityPending: ctx.stats.highPriorityPending,
    approvedWeek: ctx.stats.approvedWeekCount,
    roomReservationsToday: ctx.stats.roomReservationsToday,
  };

  return {
    title: `Agenda journalier — ${ctx.todayLabel}`,
    briefing,
    highlights,
    conflicts,
    agendaItems: agendaItemsBase.map((item) => ({
      ...item,
      conflict: conflictedIds.has(item.id),
    })),
    pendingItems,
    pendingCount: ctx.stats.pendingCount,
    stats,
  };
}

export async function generateDailyAgenda(
  referenceDate?: Date
): Promise<AiGenerationResult<DailyAgendaResult>> {
  const ctx = await buildAssistantAiContext(referenceDate);
  const payload = {
    ...contextToPromptPayload(ctx),
    conflicts: detectDailyAgendaConflicts(ctx.approvedToday).map((c) => ({
      timeLabel: c.timeLabel,
      sameStart: c.sameStart,
      message: c.message,
      appointments: c.items,
    })),
  };

  const aiRaw = await completeChat([
    {
      role: 'system',
      content:
        'Tu es l\'assistante IA du cabinet DGA. Rédige un briefing d\'agenda journalier en français. Signale clairement tout conflit d\'horaire (même heure de début ou chevauchement). JSON : {"title":"...","briefing":"markdown","highlights":["..."]}',
    },
    {
      role: 'user',
      content: JSON.stringify(payload),
    },
  ]);

  const parsed = aiRaw
    ? parseJsonFromLlm<{ title: string; briefing: string; highlights: string[] }>(aiRaw)
    : null;

  const fallback = fallbackDailyAgenda(ctx);

  if (parsed?.briefing) {
    const conflictHighlights = fallback.highlights.filter(
      (h) => h.startsWith('⚠') || h.includes('RDV commencent') || h.includes('Chevauchement')
    );
    const mergedHighlights = [
      ...conflictHighlights,
      ...(parsed.highlights?.length
        ? parsed.highlights.filter(
            (h) =>
              !h.startsWith('⚠') &&
              !h.toLowerCase().includes('conflit') &&
              !h.includes('RDV commencent') &&
              !h.includes('Chevauchement') &&
              !/^\d+ rendez-vous confirmé/.test(h)
          )
        : fallback.highlights.filter(
            (h) =>
              !h.startsWith('⚠') &&
              !h.toLowerCase().includes('conflit') &&
              !h.includes('RDV commencent') &&
              !h.includes('Chevauchement')
          )),
    ];

    const briefing =
      fallback.conflicts.length > 0
        ? fallback.briefing
        : parsed.briefing;

    const data = enrichDailyAgendaResult(
      {
        ...fallback,
        title: parsed.title || fallback.title,
        briefing,
        highlights: mergedHighlights.length ? mergedHighlights : fallback.highlights,
        aiNarrative: fallback.conflicts.length > 0 ? undefined : parsed.briefing,
      },
      ctx.approvedToday
    );

    return {
      mode: 'ai',
      generatedAt: new Date().toISOString(),
      data,
    };
  }

  return {
    mode: 'fallback',
    generatedAt: new Date().toISOString(),
    data: enrichDailyAgendaResult(fallback, ctx.approvedToday),
  };
}
