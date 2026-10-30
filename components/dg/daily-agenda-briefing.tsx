'use client';

import { useMemo } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck2,
  Clock3,
  Hourglass,
  Lightbulb,
  UserRound,
  Zap,
} from 'lucide-react';
import { APPOINTMENT_PRIORITY_LABELS } from '@/lib/dg/appointments-review';
import type { Priority } from '@prisma/client';
import type {
  AiGenerationMode,
  DailyAgendaConflict,
  DailyAgendaResult,
} from '@/lib/ai/types';
import { DailyAgendaCharts } from '@/components/dg/daily-agenda-charts';
import { enrichDailyAgendaResult } from '@/lib/ai/enrich-daily-agenda';
import { cn } from '@/lib/utils';

function parseTimeRange(time: string) {
  const [start, end] = time.split(/\s*[–-]\s*/);
  return { start: start?.trim() ?? '', end: end?.trim() ?? '' };
}

function priorityLabel(priority: string) {
  return APPOINTMENT_PRIORITY_LABELS[priority as Priority] ?? priority;
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        'dg-ai-chip',
        priority === 'HIGH' && 'dg-ai-chip--high',
        priority === 'MEDIUM' && 'dg-ai-chip--medium',
        priority === 'LOW' && 'dg-ai-chip--low'
      )}
    >
      {priorityLabel(priority)}
    </span>
  );
}

function UrgencyBadge({ label, ultra }: { label: string; ultra?: boolean }) {
  if (ultra) {
    return (
      <span className="dg-ai-chip dg-ai-chip--ultra">
        <Zap className="h-2.5 w-2.5" aria-hidden />
        Ultra urgent
      </span>
    );
  }
  if (label === 'Normal') return null;
  return (
    <span
      className={cn(
        'dg-ai-chip',
        label === 'Critique' && 'dg-ai-chip--critique',
        label === 'Très urgent' && 'dg-ai-chip--tres-urgent',
        label === 'Urgent' && 'dg-ai-chip--urgent'
      )}
    >
      {label}
    </span>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'warn' | 'ok';
}) {
  return (
    <div className={cn('dg-ai-kpi', tone === 'warn' && 'dg-ai-kpi--warn', tone === 'ok' && 'dg-ai-kpi--ok')}>
      <span className="dg-ai-kpi-value">{value}</span>
      <span className="dg-ai-kpi-label">{label}</span>
    </div>
  );
}

function ConflictsBanner({ conflicts }: { conflicts: DailyAgendaConflict[] }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="dg-ai-conflict-banner" role="alert">
      <div className="dg-ai-conflict-banner-icon">
        <AlertTriangle className="h-4 w-4" aria-hidden />
      </div>
      <div className="dg-ai-conflict-banner-body">
        <p className="dg-ai-conflict-banner-title">
          {conflicts.length} conflit{conflicts.length > 1 ? 's' : ''} d&apos;horaire — action requise
        </p>
        <ul className="dg-ai-conflict-banner-list">
          {conflicts.map((c) => (
            <li key={c.id}>{c.message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AgendaTimeline({ items }: { items: DailyAgendaResult['agendaItems'] }) {
  if (items.length === 0) {
    return (
      <div className="dg-ai-timeline-empty">
        <CalendarCheck2 className="h-5 w-5 opacity-40" aria-hidden />
        <p>Aucun rendez-vous confirmé aujourd&apos;hui</p>
      </div>
    );
  }

  return (
    <ol className="dg-ai-timeline">
      {items.map((item, idx) => {
        const { start, end } = parseTimeRange(item.time);
        return (
          <li
            key={item.id}
            className={cn('dg-ai-timeline-item', item.conflict && 'dg-ai-timeline-item--conflict')}
          >
            <div className="dg-ai-timeline-time">
              <span className="dg-ai-timeline-start">{start}</span>
              <span className="dg-ai-timeline-end">{end}</span>
            </div>
            <div className="dg-ai-timeline-rail" aria-hidden>
              <span className="dg-ai-timeline-dot" />
              {idx < items.length - 1 ? <span className="dg-ai-timeline-line" /> : null}
            </div>
            <article className="dg-ai-timeline-card">
              <div className="dg-ai-timeline-card-head">
                <h4>{item.title}</h4>
                {item.conflict ? (
                  <span className="dg-ai-chip dg-ai-chip--conflict">
                    <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
                    Conflit
                  </span>
                ) : null}
              </div>
              <p className="dg-ai-timeline-meta">
                <UserRound className="h-3 w-3" aria-hidden />
                {item.requester}
              </p>
              <div className="dg-ai-timeline-badges">
                <PriorityBadge priority={item.priority} />
                <UrgencyBadge label={item.urgencyLabel} ultra={item.urgentOverride} />
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

function PendingQueue({ items }: { items: DailyAgendaResult['pendingItems'] }) {
  if (items.length === 0) {
    return <p className="dg-ai-queue-empty">Aucune demande en attente de validation.</p>;
  }

  return (
    <ul className="dg-ai-queue">
      {items.map((item) => (
        <li key={`${item.title}-${item.slot}`} className="dg-ai-queue-item">
          <div className="dg-ai-queue-icon">
            <Hourglass className="h-3.5 w-3.5" aria-hidden />
          </div>
          <div className="dg-ai-queue-body">
            <p className="dg-ai-queue-title">{item.title}</p>
            <p className="dg-ai-queue-slot">
              <Clock3 className="h-3 w-3" aria-hidden />
              {item.slot}
            </p>
            <p className="dg-ai-queue-meta">
              <UserRound className="h-3 w-3" aria-hidden />
              {item.requester}
            </p>
            <div className="dg-ai-timeline-badges">
              <PriorityBadge priority={item.priority} />
              <UrgencyBadge label={item.urgencyLabel} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Recommendations({ highlights }: { highlights: string[] }) {
  const items = highlights.filter(
    (h) =>
      !h.startsWith('⚠') &&
      !h.toLowerCase().includes('conflit') &&
      !h.includes('Chevauchement') &&
      !h.includes('RDV commencent')
  );
  if (items.length === 0) return null;

  return (
    <div className="dg-ai-reco">
      <div className="dg-ai-section-label">
        <Lightbulb className="h-3.5 w-3.5" aria-hidden />
        Recommandations
      </div>
      <ul className="dg-ai-reco-list">
        {items.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}

type DailyAgendaBriefingProps = {
  data: DailyAgendaResult;
  mode: AiGenerationMode;
  /** Rend le briefing dense pour tenir sans scroll (dialogue). */
  compact?: boolean;
};

export function DailyAgendaBriefing({ data, compact = false }: DailyAgendaBriefingProps) {
  const view = useMemo(() => enrichDailyAgendaResult(data), [data]);
  const { stats, conflicts } = view;
  const hasConflicts = conflicts.length > 0;

  return (
    <div
      className={cn(
        'dg-ai-briefing',
        compact && 'dg-ai-briefing--compact',
        hasConflicts && 'dg-ai-briefing--conflict'
      )}
    >
      <div className="dg-ai-kpi-grid">
        <KpiCard label="RDV confirmés" value={stats.approvedToday} tone="ok" />
        <KpiCard label="Terminés / passés" value={stats.completedOrPast ?? 0} />
        <KpiCard label="En attente" value={stats.pendingQueue} tone={stats.pendingQueue > 0 ? 'warn' : 'default'} />
        <KpiCard
          label="Conflits"
          value={stats.conflicts}
          tone={hasConflicts ? 'warn' : 'default'}
        />
        <KpiCard label="Cette semaine" value={stats.approvedWeek} />
      </div>

      <ConflictsBanner conflicts={conflicts} />

      <div className="dg-ai-briefing-grid">
        <section
          className={cn('dg-ai-briefing-section', hasConflicts && 'dg-ai-briefing-section--conflict')}
          aria-labelledby="dg-ai-agenda-title"
        >
          <div className="dg-ai-section-label" id="dg-ai-agenda-title">
            <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />
            Agenda confirmé
            {hasConflicts ? (
              <span className="dg-ai-section-alert">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {conflicts.length} chevauchement{conflicts.length > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>
          <AgendaTimeline items={view.agendaItems} />
        </section>

        <aside className="dg-ai-briefing-aside">
          <section className="dg-ai-briefing-section" aria-labelledby="dg-ai-queue-title">
            <div className="dg-ai-section-label" id="dg-ai-queue-title">
              <Hourglass className="h-3.5 w-3.5" aria-hidden />
              File d&apos;attente
              {view.pendingCount > 0 ? (
                <span className="dg-ai-section-count">{view.pendingCount}</span>
              ) : null}
            </div>
            <PendingQueue items={view.pendingItems} />
          </section>

          <Recommendations highlights={view.highlights} />
        </aside>
      </div>

      <section className="dg-ai-briefing-section" aria-labelledby="dg-ai-charts-title">
        <div className="dg-ai-section-label" id="dg-ai-charts-title">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden />
          Vue analytique
        </div>
        <DailyAgendaCharts data={view} compact={compact} />
      </section>
    </div>
  );
}
