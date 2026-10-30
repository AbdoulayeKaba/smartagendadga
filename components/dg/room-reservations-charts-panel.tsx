'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from 'recharts';
import {
  Activity,
  Ban,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Eye,
  EyeOff,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { RoomReservationAnalytics } from '@/lib/dg/room-reservation-analytics';
import {
  ROOM_RESERVATION_STATUS_CHART_COLORS,
  ROOM_RESERVATION_STATUS_FLOW_ORDER,
} from '@/lib/dg/room-reservation-status-colors';
import { ROOM_RESERVATION_STATUS_LABELS } from '@/lib/dg/room-reservation-review';
import { cn } from '@/lib/utils';

const FLOW_VISIBILITY_KEY = 'dg.room-res.charts.flow.visible';

const statusPieConfig = {
  PENDING: { label: 'En attente', color: ROOM_RESERVATION_STATUS_CHART_COLORS.PENDING },
  CONFIRMED: { label: 'Confirmées', color: ROOM_RESERVATION_STATUS_CHART_COLORS.CONFIRMED },
  COMPLETED: { label: 'Terminées', color: ROOM_RESERVATION_STATUS_CHART_COLORS.COMPLETED },
  REJECTED: { label: 'Refusées', color: ROOM_RESERVATION_STATUS_CHART_COLORS.REJECTED },
  CANCELLED: { label: 'Annulées', color: ROOM_RESERVATION_STATUS_CHART_COLORS.CANCELLED },
} satisfies ChartConfig;

type Props = {
  analytics: RoomReservationAnalytics;
  year?: number;
};

function MixBars({
  rows,
  total,
}: {
  rows: { key: string; label: string; value: number; fill: string }[];
  total: number;
}) {
  const safeTotal = total > 0 ? total : 1;
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <ul className="admin-appt-mix-bars">
      {rows.map((row) => {
        const pct = Math.round((row.value / safeTotal) * 100);
        return (
          <li key={row.key} className="admin-appt-mix-row">
            <div className="admin-appt-mix-row-top">
              <span className="admin-appt-mix-label">{row.label}</span>
              <span className="admin-appt-mix-meta">
                <strong>{row.value}</strong>
                <span>{pct}%</span>
              </span>
            </div>
            <span className="admin-appt-mix-track" aria-hidden>
              <span
                className="admin-appt-mix-fill"
                style={{
                  width: `${(row.value / max) * 100}%`,
                  background: row.fill,
                }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function readFlowVisible(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(FLOW_VISIBILITY_KEY);
    if (raw === null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

export function RoomReservationsChartsPanel({ analytics, year }: Props) {
  const [flowVisible, setFlowVisible] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFlowVisible(readFlowVisible());
    setHydrated(true);
  }, []);

  const toggleFlow = () => {
    setFlowVisible((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(FLOW_VISIBILITY_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const chartYear = year ?? analytics.year;
  const flowPeak = analytics.monthlyFlow.reduce(
    (best, row) => (row.total > best.total ? row : best),
    analytics.monthlyFlow[0] ?? {
      total: 0,
      label: '',
      month: 0,
      PENDING: 0,
      CONFIRMED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    }
  );
  const flowMax = Math.max(1, ...analytics.monthlyFlow.map((row) => row.total));
  const activeMonths = analytics.monthlyFlow.filter((row) => row.total > 0).length;
  const showFlow = !hydrated || flowVisible;

  const statusLegend = ROOM_RESERVATION_STATUS_FLOW_ORDER.map((key) => {
    const found = analytics.byStatus.find((row) => row.key === key);
    return {
      key,
      label: ROOM_RESERVATION_STATUS_LABELS[key],
      value: found?.value ?? 0,
      fill: ROOM_RESERVATION_STATUS_CHART_COLORS[key],
    };
  });

  const pieData = statusLegend
    .filter((row) => row.value > 0)
    .map((row) => ({
      key: row.key,
      name: row.label,
      value: row.value,
      fill: row.fill,
    }));

  const usageRows = analytics.byUsage.map((row) => ({
    key: row.key,
    label: row.label,
    value: row.value,
    fill: row.fill ?? ROOM_RESERVATION_STATUS_CHART_COLORS.CONFIRMED,
  }));

  return (
    <section className="admin-appt-insight dg-room-res-insight" aria-label="Analyse des réservations salles">
      <div className="admin-appt-insight-kpis">
        <div className="admin-appt-insight-kpi" data-tone="teal">
          <Activity className="admin-appt-insight-kpi-icon" aria-hidden />
          <div>
            <p className="admin-appt-insight-kpi-label">Total {chartYear}</p>
            <p className="admin-appt-insight-kpi-value">{analytics.total}</p>
          </div>
        </div>
        <div className="admin-appt-insight-kpi" data-tone="amber">
          <Clock3 className="admin-appt-insight-kpi-icon" aria-hidden />
          <div>
            <p className="admin-appt-insight-kpi-label">En attente</p>
            <p className="admin-appt-insight-kpi-value">{analytics.pendingCount}</p>
          </div>
        </div>
        <div className="admin-appt-insight-kpi" data-tone="green">
          <CheckCircle2 className="admin-appt-insight-kpi-icon" aria-hidden />
          <div>
            <p className="admin-appt-insight-kpi-label">Confirmées</p>
            <p className="admin-appt-insight-kpi-value">{analytics.confirmedCount}</p>
          </div>
        </div>
        <div className="admin-appt-insight-kpi" data-tone="rose">
          <Ban className="admin-appt-insight-kpi-icon" aria-hidden />
          <div>
            <p className="admin-appt-insight-kpi-label">Taux confirmé</p>
            <p className="admin-appt-insight-kpi-value">{analytics.confirmationRate}%</p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'admin-appt-insight-grid',
          showFlow ? 'dg-room-res-insight-grid--with-flow' : 'dg-room-res-insight-grid--no-flow'
        )}
      >
        {!showFlow ? (
          <div className="dg-room-res-flow-collapsed dg-room-res-flow-collapsed--full">
            <span className="dg-room-res-flow-collapsed-label">
              <Activity className="h-3 w-3" aria-hidden />
              Flux mensuel {chartYear}
            </span>
            <button
              type="button"
              className="dg-room-res-flow-toggle"
              onClick={toggleFlow}
              aria-pressed={false}
              aria-label="Afficher le flux mensuel"
            >
              <Eye className="h-3 w-3" aria-hidden />
              Afficher
            </button>
          </div>
        ) : null}

        <article className="admin-appt-insight-card admin-appt-insight-card--status">
          <header className="admin-appt-insight-card-head">
            <span className="admin-appt-insight-card-icon" aria-hidden>
              <PieIcon className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <h3 className="admin-appt-insight-card-title">Statuts</h3>
                <p className="admin-appt-insight-card-sub">
                {analytics.total > 0
                  ? `${analytics.confirmationRate}% validés${
                      analytics.pendingCount > 0 ? ` · ${analytics.pendingCount} en attente` : ''
                    }`
                  : 'Aucune réservation'}
              </p>
            </div>
            <span className="admin-appt-insight-pill">{analytics.total}</span>
          </header>
          <div className="admin-appt-insight-status-body">
            {pieData.length === 0 ? (
              <p className="admin-appt-insight-empty">Aucune donnée à afficher.</p>
            ) : (
              <>
                <ChartContainer config={statusPieConfig} className="admin-appt-insight-pie">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={28}
                      outerRadius={42}
                      paddingAngle={2}
                      strokeWidth={2}
                      stroke="var(--card, #fff)"
                    >
                      {pieData.map((row) => (
                        <Cell key={row.key} fill={row.fill} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) - 2}
                                className="fill-[var(--admin-foreground)] text-[0.7rem] font-bold"
                              >
                                {analytics.total}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy ?? 0) + 12}
                                className="fill-[var(--admin-muted)] text-[9px]"
                              >
                                total
                              </tspan>
                            </text>
                          );
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="admin-appt-insight-legend">
                  {statusLegend.map((row) => (
                    <li key={row.key}>
                      <span className="admin-appt-insight-legend-dot" style={{ background: row.fill }} />
                      <span className="admin-appt-insight-legend-label">{row.label}</span>
                      <strong>{row.value}</strong>
                      <span className="admin-appt-insight-legend-pct">
                        {analytics.total > 0 ? Math.round((row.value / analytics.total) * 100) : 0}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </article>

        {showFlow ? (
          <article className="admin-appt-insight-card admin-appt-insight-card--flow">
            <header className="admin-appt-insight-card-head">
              <span className="admin-appt-insight-card-icon admin-appt-insight-card-icon--flow" aria-hidden>
                <Activity className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="admin-appt-insight-card-title">Flux mensuel {chartYear}</h3>
                <p className="admin-appt-insight-card-sub">
                  {flowPeak.total > 0
                    ? `Pic en ${flowPeak.label} · ${activeMonths} mois actif${activeMonths > 1 ? 's' : ''}`
                    : 'Aucune activité'}
                </p>
              </div>
              {flowPeak.total > 0 ? (
                <span className="admin-appt-insight-pill">Pic {flowPeak.total}</span>
              ) : null}
              <button
                type="button"
                className="dg-room-res-flow-toggle"
                onClick={toggleFlow}
                aria-pressed={true}
                aria-label="Masquer le flux mensuel"
                title="Masquer le flux mensuel"
              >
                <EyeOff className="h-3 w-3" aria-hidden />
                <span>Masquer</span>
              </button>
            </header>
            <div className="admin-appt-insight-flow-body">
              <ChartContainer
                config={statusPieConfig}
                className="admin-appt-insight-flow-chart admin-appt-insight-flow-chart--solo aspect-auto!"
              >
                <BarChart
                  data={analytics.monthlyFlow}
                  margin={{ top: 6, right: 6, left: -12, bottom: 2 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 6" strokeOpacity={0.3} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={({ x, y, payload }) => {
                      const isPeak = payload.value === flowPeak.label && flowPeak.total > 0;
                      return (
                        <text
                          x={x}
                          y={y}
                          dy={10}
                          textAnchor="middle"
                          fill={isPeak ? 'var(--admin-primary)' : 'var(--admin-muted)'}
                          fontSize={9}
                          fontWeight={isPeak ? 700 : 500}
                        >
                          {payload.value}
                        </text>
                      );
                    }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={18}
                    fontSize={8}
                    domain={[0, Math.max(flowMax, 2)]}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {ROOM_RESERVATION_STATUS_FLOW_ORDER.map((status, index) => (
                    <Bar
                      key={status}
                      dataKey={status}
                      name={ROOM_RESERVATION_STATUS_LABELS[status]}
                      stackId="month"
                      fill={ROOM_RESERVATION_STATUS_CHART_COLORS[status]}
                      maxBarSize={22}
                      isAnimationActive={false}
                      radius={
                        index === ROOM_RESERVATION_STATUS_FLOW_ORDER.length - 1
                          ? [3, 3, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    >
                      {analytics.monthlyFlow.map((row) => (
                        <Cell
                          key={`${status}-${row.month}`}
                          fillOpacity={
                            row.total === 0
                              ? 0
                              : row.month === flowPeak.month
                                ? 1
                                : 0.85
                          }
                        />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ChartContainer>
              <ul className="admin-appt-insight-flow-legend">
                {statusLegend.map((row) => (
                  <li key={row.key}>
                    <span className="admin-appt-insight-legend-dot" style={{ background: row.fill }} />
                    {row.label}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ) : null}

        <article className="admin-appt-insight-card admin-appt-insight-card--mix">
          <header className="admin-appt-insight-card-head">
            <span className="admin-appt-insight-card-icon admin-appt-insight-card-icon--mix" aria-hidden>
              <DoorOpen className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <h3 className="admin-appt-insight-card-title">Type d&apos;usage</h3>
              <p className="admin-appt-insight-card-sub">
                {usageRows[0] ? `Top : ${usageRows[0].label}` : 'Aucune donnée'}
              </p>
            </div>
            {usageRows[0] ? <span className="admin-appt-insight-pill">{usageRows[0].value}</span> : null}
          </header>
          <div className="admin-appt-insight-card-body">
            {usageRows.length === 0 ? (
              <p className="admin-appt-insight-empty">Aucune donnée d&apos;usage.</p>
            ) : (
              <MixBars rows={usageRows} total={analytics.total} />
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
