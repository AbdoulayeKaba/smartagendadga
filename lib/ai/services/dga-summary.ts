import { completeChat, parseJsonFromLlm } from '@/lib/ai/client';
import {
  buildAssistantAiContext,
  contextToPromptPayload,
  formatAgendaTimeRange,
} from '@/lib/ai/context';
import type { AiGenerationResult, DgaDaySummaryResult } from '@/lib/ai/types';
import { detectDailyAgendaConflicts } from '@/lib/ai/agenda-conflicts';

function computeLoadPercent(weekMinutes: number) {
  return Math.min(100, Math.round((weekMinutes / (5 * 8 * 60)) * 100));
}

function fallbackDgaSummary(ctx: Awaited<ReturnType<typeof buildAssistantAiContext>>): DgaDaySummaryResult {
  const loadPercent = computeLoadPercent(
    ctx.approvedToday.reduce((acc, a) => acc + (a.endAt.getTime() - a.startAt.getTime()) / 60000, 0)
  );

  const conflicts = detectDailyAgendaConflicts(ctx.approvedToday);
  const keyPoints: string[] = [];

  if (conflicts.length > 0) {
    keyPoints.push(
      `⚠ ${conflicts.length} conflit${conflicts.length > 1 ? 's' : ''} d'horaire sur l'agenda confirmé — arbitrage urgent.`
    );
    keyPoints.push(...conflicts.map((c) => c.message));
  }

  if (ctx.approvedToday.length > 0) {
    const first = ctx.approvedToday[0]!;
    const last = ctx.approvedToday[ctx.approvedToday.length - 1]!;
    keyPoints.push(
      `Journée structurée de ${formatAgendaTimeRange(first.startAt, first.endAt)} à ${formatAgendaTimeRange(last.startAt, last.endAt)}.`
    );
  }

  if (ctx.stats.pendingCount > 0) {
    keyPoints.push(`File de validation : ${ctx.stats.pendingCount} demande(s) en attente.`);
  }

  if (ctx.stats.urgentPending > 0) {
    keyPoints.push(`${ctx.stats.urgentPending} demande(s) marquée(s) ultra urgentes.`);
  }

  if (ctx.tomorrowUrgent.length > 0) {
    keyPoints.push(`Anticipation : ${ctx.tomorrowUrgent.length} RDV ultra urgent(s) demain.`);
  }

  const summaryParts = [
    `Synthèse de la journée du DGA pour le ${ctx.todayLabel}.`,
    conflicts.length > 0
      ? `Attention : ${conflicts.length} chevauchement${conflicts.length > 1 ? 's' : ''} d'horaire détecté${conflicts.length > 1 ? 's' : ''} dans l'agenda.`
      : null,
    ctx.approvedToday.length > 0
      ? `${ctx.approvedToday.length} rendez-vous confirmé${ctx.approvedToday.length > 1 ? 's' : ''} au programme.`
      : "Aucun rendez-vous confirmé — journée potentiellement disponible pour dossiers prioritaires.",
    ctx.stats.pendingCount > 0
      ? `${ctx.stats.pendingCount} demande(s) restent à arbitrer par l'assistante.`
      : 'Aucune demande en attente de validation.',
  ];

  return {
    title: `Résumé DGA — ${ctx.todayLabel}`,
    summary: summaryParts.filter(Boolean).join(' '),
    keyPoints,
    workload: {
      appointmentsToday: ctx.approvedToday.length,
      pendingQueue: ctx.stats.pendingCount,
      loadPercent,
    },
  };
}

export async function generateDgaDaySummary(): Promise<AiGenerationResult<DgaDaySummaryResult>> {
  const ctx = await buildAssistantAiContext();
  const payload = contextToPromptPayload(ctx);

  const aiRaw = await completeChat([
    {
      role: 'system',
      content:
        'Tu rédiges un résumé exécutif de la journée du Directeur Général Adjoint (DGA) pour son assistante. Ton professionnel, factuel. JSON uniquement : {"title":"...","summary":"...","keyPoints":["..."]}',
    },
    { role: 'user', content: JSON.stringify(payload) },
  ]);

  const parsed = aiRaw
    ? parseJsonFromLlm<{ title: string; summary: string; keyPoints: string[] }>(aiRaw)
    : null;

  const fallback = fallbackDgaSummary(ctx);

  if (parsed?.summary) {
    return {
      mode: 'ai',
      generatedAt: new Date().toISOString(),
      data: {
        ...fallback,
        title: parsed.title || fallback.title,
        summary: parsed.summary,
        keyPoints: parsed.keyPoints?.length ? parsed.keyPoints : fallback.keyPoints,
      },
    };
  }

  return {
    mode: 'fallback',
    generatedAt: new Date().toISOString(),
    data: fallback,
  };
}
