'use client';

import { useMemo } from 'react';
import { BarChart3, Layers } from 'lucide-react';
import type { DailyAgendaResult } from '@/lib/ai/types';

type Segment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type BarDatum = Segment;

const PALETTE = {
  confirmed: '#16a34a',
  past: '#64748b',
  pending: '#d97706',
  conflict: '#dc2626',
  high: '#dc2626',
  medium: '#d97706',
  low: '#16a34a',
  week: '#2563eb',
  room: '#7c3aed',
  neutral: '#94a3b8',
};

function StackedBar({ segments, total }: { segments: Segment[]; total: number }) {
  const safeTotal = total > 0 ? total : 1;
  const visible = segments.filter((s) => s.value > 0);

  return (
    <div className="dg-ai-stacked">
      <div className="dg-ai-stacked-track" role="img" aria-label="Composition du jour">
        {visible.length === 0 ? (
          <span className="dg-ai-stacked-empty">Aucun point</span>
        ) : (
          visible.map((s) => (
            <span
              key={s.key}
              className="dg-ai-stacked-seg"
              style={{ width: `${(s.value / safeTotal) * 100}%`, background: s.color }}
              title={`${s.label} : ${s.value}`}
            >
              <span className="dg-ai-stacked-seg-value">{s.value}</span>
            </span>
          ))
        )}
      </div>
      <ul className="dg-ai-stacked-legend">
        {segments.map((s) => (
          <li key={s.key} className="dg-ai-stacked-chip">
            <span className="dg-ai-stacked-chip-dot" style={{ background: s.color }} />
            <span className="dg-ai-stacked-chip-label">{s.label}</span>
            <span className="dg-ai-stacked-chip-value">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarSeries({ data }: { data: BarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ul className="dg-ai-chart-bars">
      {data.map((d) => (
        <li key={d.key} className="dg-ai-chart-bar-row">
          <span className="dg-ai-chart-bar-label">{d.label}</span>
          <span className="dg-ai-chart-bar-track">
            <span
              className="dg-ai-chart-bar-fill"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color,
              }}
            />
          </span>
          <span className="dg-ai-chart-bar-value">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function DailyAgendaCharts({
  data,
  compact = false,
}: {
  data: DailyAgendaResult;
  compact?: boolean;
}) {
  const { stats } = data;

  const priorityData = useMemo<BarDatum[]>(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<string, number>;
    for (const item of [...data.agendaItems, ...data.pendingItems]) {
      if (item.priority in counts) counts[item.priority] += 1;
    }
    return [
      { key: 'HIGH', label: 'Élevée', value: counts.HIGH, color: PALETTE.high },
      { key: 'MEDIUM', label: 'Moyenne', value: counts.MEDIUM, color: PALETTE.medium },
      { key: 'LOW', label: 'Basse', value: counts.LOW, color: PALETTE.low },
    ];
  }, [data.agendaItems, data.pendingItems]);

  const indicatorData = useMemo<BarDatum[]>(
    () => [
      { key: 'week', label: 'Cette semaine', value: stats.approvedWeek, color: PALETTE.week },
      { key: 'today', label: "Aujourd'hui", value: stats.approvedToday, color: PALETTE.confirmed },
      {
        key: 'past',
        label: 'Terminés / passés',
        value: stats.completedOrPast ?? 0,
        color: PALETTE.past,
      },
      { key: 'pending', label: 'En attente', value: stats.pendingQueue, color: PALETTE.pending },
      {
        key: 'highPending',
        label: 'Haute prio. en attente',
        value: stats.highPriorityPending,
        color: PALETTE.high,
      },
      { key: 'rooms', label: 'Salles réservées', value: stats.roomReservationsToday, color: PALETTE.room },
      { key: 'conflicts', label: "Conflits d'horaire", value: stats.conflicts, color: PALETTE.conflict },
    ],
    [stats]
  );

  const compositionSegments = useMemo<Segment[]>(
    () => [
      { key: 'confirmed', label: 'Confirmés', value: stats.approvedToday, color: PALETTE.confirmed },
      {
        key: 'past',
        label: 'Terminés / passés',
        value: stats.completedOrPast ?? 0,
        color: PALETTE.past,
      },
      { key: 'pending', label: 'En attente', value: stats.pendingQueue, color: PALETTE.pending },
      { key: 'conflict', label: 'Conflits', value: stats.conflicts, color: PALETTE.conflict },
    ],
    [stats]
  );

  const compositionTotal =
    stats.approvedToday +
    (stats.completedOrPast ?? 0) +
    stats.pendingQueue +
    stats.conflicts;

  return (
    <div className="dg-ai-charts">
      <section className="dg-ai-chart-card">
        <div className="dg-ai-section-label">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Composition du jour
          <span className="dg-ai-chart-total">{compositionTotal} pts</span>
        </div>
        <StackedBar segments={compositionSegments} total={compositionTotal} />
      </section>

      <section className="dg-ai-chart-card">
        <div className="dg-ai-section-label">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden />
          Répartition par priorité
        </div>
        <BarSeries data={priorityData} />
      </section>

      {compact ? null : (
        <section className="dg-ai-chart-card dg-ai-chart-card--wide">
          <div className="dg-ai-section-label">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            Indicateurs clés
          </div>
          <BarSeries data={indicatorData} />
        </section>
      )}
    </div>
  );
}
