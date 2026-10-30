'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, PieChart as PieIcon } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  APPOINTMENT_STATUS_CHART_COLORS,
  APPOINTMENT_STATUS_FLOW_ORDER,
  type AppointmentsOwnAnalytics,
} from '@/lib/dg/appointments-own-analytics';
import { APPOINTMENT_STATUS_LABELS } from '@/lib/dg/appointments-review';

type Props = {
  analytics: AppointmentsOwnAnalytics;
};

const statusPieConfig = {
  PENDING: { label: 'En attente', color: APPOINTMENT_STATUS_CHART_COLORS.PENDING },
  APPROVED: { label: 'Approuvés', color: APPOINTMENT_STATUS_CHART_COLORS.APPROVED },
  REJECTED: { label: 'Refusés', color: APPOINTMENT_STATUS_CHART_COLORS.REJECTED },
} satisfies ChartConfig;

const flowConfig = {
  PENDING: { label: 'En attente', color: APPOINTMENT_STATUS_CHART_COLORS.PENDING },
  APPROVED: { label: 'Approuvés', color: APPOINTMENT_STATUS_CHART_COLORS.APPROVED },
  REJECTED: { label: 'Refusés', color: APPOINTMENT_STATUS_CHART_COLORS.REJECTED },
} satisfies ChartConfig;

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

export function AppointmentsOwnChartsPanel({ analytics }: Props) {
  const flowPeak = analytics.monthlyFlow.reduce(
    (best, row) => (row.total > best.total ? row : best),
    analytics.monthlyFlow[0] ?? {
      total: 0,
      label: '',
      month: 0,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
    }
  );
  const flowMax = Math.max(1, ...analytics.monthlyFlow.map((row) => row.total));
  const activeMonths = analytics.monthlyFlow.filter((row) => row.total > 0).length;

  const statusLegend = APPOINTMENT_STATUS_FLOW_ORDER.map((key) => {
    const found = analytics.byStatus.find((row) => row.key === key);
    return {
      key,
      label: APPOINTMENT_STATUS_LABELS[key],
      value: found?.value ?? 0,
      fill: APPOINTMENT_STATUS_CHART_COLORS[key],
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

  const mixRows = [
    ...analytics.byUrgency.slice(0, 3),
    ...analytics.byType.slice(0, 2),
  ].slice(0, 4);

  return (
    <section className="admin-appt-insight" aria-label="Analyse de mes demandes">
      <div className="admin-appt-insight-grid">
        <article className="admin-appt-insight-card admin-appt-insight-card--status">
          <header className="admin-appt-insight-card-head">
            <span className="admin-appt-insight-card-icon" aria-hidden>
              <PieIcon className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <h3 className="admin-appt-insight-card-title">Répartition des statuts</h3>
              <p className="admin-appt-insight-card-sub">
                {analytics.total} demande{analytics.total > 1 ? 's' : ''} · {analytics.year}
              </p>
            </div>
          </header>
          <div className="admin-appt-insight-status-body">
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
                            {analytics.approvalRate}%
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 12}
                            className="fill-[var(--admin-muted)] text-[9px]"
                          >
                            approuvés
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
          </div>
        </article>

        <article className="admin-appt-insight-card admin-appt-insight-card--flow">
          <header className="admin-appt-insight-card-head">
            <span className="admin-appt-insight-card-icon admin-appt-insight-card-icon--flow" aria-hidden>
              <Activity className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="admin-appt-insight-card-title">Flux mensuel {analytics.year}</h3>
              <p className="admin-appt-insight-card-sub">
                {flowPeak.total > 0
                  ? `Pic ${flowPeak.label} · ${activeMonths} mois actif${activeMonths > 1 ? 's' : ''}`
                  : 'Aucune activité enregistrée'}
              </p>
            </div>
            {flowPeak.total > 0 ? (
              <span className="admin-appt-insight-pill">Pic {flowPeak.total}</span>
            ) : null}
          </header>
          <div className="admin-appt-insight-flow-body">
            <ChartContainer config={flowConfig} className="admin-appt-insight-flow-chart admin-appt-insight-flow-chart--solo">
              <BarChart
                data={analytics.monthlyFlow}
                margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                barCategoryGap="34%"
              >
                <defs>
                  <linearGradient id="apptBarApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={APPOINTMENT_STATUS_CHART_COLORS.APPROVED} stopOpacity={1} />
                    <stop offset="100%" stopColor={APPOINTMENT_STATUS_CHART_COLORS.APPROVED} stopOpacity={0.72} />
                  </linearGradient>
                  <linearGradient id="apptBarPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={APPOINTMENT_STATUS_CHART_COLORS.PENDING} stopOpacity={1} />
                    <stop offset="100%" stopColor={APPOINTMENT_STATUS_CHART_COLORS.PENDING} stopOpacity={0.75} />
                  </linearGradient>
                </defs>
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
                <Bar
                  dataKey="PENDING"
                  name={APPOINTMENT_STATUS_LABELS.PENDING}
                  stackId="month"
                  fill="url(#apptBarPending)"
                  maxBarSize={16}
                >
                  {analytics.monthlyFlow.map((row) => (
                    <Cell
                      key={`PENDING-${row.month}`}
                      fillOpacity={row.total === 0 ? 0.08 : row.month === flowPeak.month ? 1 : 0.78}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="APPROVED"
                  name={APPOINTMENT_STATUS_LABELS.APPROVED}
                  stackId="month"
                  fill="url(#apptBarApproved)"
                  maxBarSize={16}
                >
                  {analytics.monthlyFlow.map((row) => (
                    <Cell
                      key={`APPROVED-${row.month}`}
                      fillOpacity={row.total === 0 ? 0.08 : row.month === flowPeak.month ? 1 : 0.78}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="REJECTED"
                  name={APPOINTMENT_STATUS_LABELS.REJECTED}
                  stackId="month"
                  fill={APPOINTMENT_STATUS_CHART_COLORS.REJECTED}
                  maxBarSize={16}
                  radius={[4, 4, 0, 0]}
                >
                  {analytics.monthlyFlow.map((row) => (
                    <Cell
                      key={`REJECTED-${row.month}`}
                      fillOpacity={row.total === 0 ? 0.08 : row.month === flowPeak.month ? 1 : 0.78}
                    />
                  ))}
                </Bar>
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

        <article className="admin-appt-insight-card admin-appt-insight-card--mix">
          <header className="admin-appt-insight-card-head">
            <span className="admin-appt-insight-card-icon admin-appt-insight-card-icon--mix" aria-hidden>
              <Activity className="h-3 w-3" />
            </span>
            <div className="min-w-0">
              <h3 className="admin-appt-insight-card-title">Profil des demandes</h3>
              <p className="admin-appt-insight-card-sub">Urgence et typologie</p>
            </div>
          </header>
          <div className="admin-appt-insight-card-body">
            {mixRows.length === 0 ? (
              <p className="admin-appt-insight-empty">Aucune donnée qualitative.</p>
            ) : (
              <MixBars rows={mixRows} total={analytics.total} />
            )}
            {analytics.byPriority.length > 0 ? (
              <div className="admin-appt-insight-priority">
                <p className="admin-appt-insight-priority-label">Priorités</p>
                <div className="admin-appt-insight-priority-chips">
                  {analytics.byPriority.map((row) => (
                    <span key={row.key} className="admin-appt-insight-priority-chip">
                      <span
                        className="admin-appt-insight-legend-dot"
                        style={{ background: row.fill }}
                      />
                      {row.label}
                      <strong>{row.value}</strong>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
