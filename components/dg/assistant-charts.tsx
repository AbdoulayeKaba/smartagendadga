'use client';

import type { ReactNode } from 'react';
import { Building2 } from 'lucide-react';
import {
  Area,
  AreaChart,
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
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type WeeklyFlowPoint = {
  label: string;
  date: string;
  approved: number;
  pending: number;
  total: number;
};

type RoomTrendPoint = {
  label: string;
  shortLabel: string;
  date: string;
  reunion: number;
  comite: number;
  autres: number;
  total: number;
};

type CountPoint = {
  key: string;
  label: string;
  value: number;
};

type AssistantChartsData = {
  weeklyFlow: WeeklyFlowPoint[];
  roomTrend: RoomTrendPoint[];
  byStatus: CountPoint[];
};

const flowConfig = {
  approved: { label: 'Approuvés', color: 'oklch(0.48 0.12 155)' },
  pending: { label: 'En attente', color: 'oklch(0.72 0.14 75)' },
} satisfies ChartConfig;

const roomTrendConfig = {
  reunion: { label: 'Réunions', color: 'oklch(0.48 0.12 155)' },
  comite: { label: 'Comités', color: 'oklch(0.52 0.1 240)' },
  autres: { label: 'Autres', color: 'oklch(0.72 0.14 75)' },
} satisfies ChartConfig;

const roomTrendLegendKeys = ['reunion', 'comite', 'autres'] as const;

const statusConfig = {
  pending: { label: 'En attente', color: 'oklch(0.72 0.14 75)' },
  approved: { label: 'Approuvés', color: 'oklch(0.48 0.12 155)' },
  rejected: { label: 'Refusés', color: 'oklch(0.58 0.18 25)' },
} satisfies ChartConfig;

function ChartCard({
  title,
  subtitle,
  hero,
  children,
}: {
  title: string;
  subtitle?: string;
  hero?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={hero ? 'dg-assistant-chart-card dg-assistant-chart-card--hero' : 'dg-assistant-chart-card'}>
      <header className="dg-assistant-chart-card-head">
        <h3 className="dg-assistant-chart-card-title">{title}</h3>
        {subtitle ? <p className="dg-assistant-chart-card-sub">{subtitle}</p> : null}
      </header>
      <div className="dg-assistant-chart-card-body">{children}</div>
    </article>
  );
}

function flowTooltipLabel(_: unknown, payload: readonly { payload?: WeeklyFlowPoint }[]) {
  const row = payload?.[0]?.payload;
  return row ? `${row.label} · ${row.date}` : '';
}

function roomTooltipLabel(_: unknown, payload: readonly { payload?: RoomTrendPoint }[]) {
  const row = payload?.[0]?.payload;
  return row ? `${row.label} · ${row.date}` : '';
}

export function AssistantCharts({ charts }: { charts: AssistantChartsData }) {
  const statusTotal = charts.byStatus.reduce((sum, item) => sum + item.value, 0);
  const statusData = charts.byStatus.filter((item) => item.value > 0);
  const flowPeak = charts.weeklyFlow.reduce(
    (best, d) => (d.total > best.total ? d : best),
    charts.weeklyFlow[0] ?? { total: 0, label: '', date: '' }
  );

  const roomPeak = charts.roomTrend.reduce(
    (best, d) => (d.total > best.total ? d : best),
    charts.roomTrend[0] ?? { total: 0, label: '', shortLabel: '', date: '' }
  );
  const roomTotal = charts.roomTrend.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="dg-assistant-analytics">
      <div className="dg-assistant-section-head">
        <div>
          <h2 className="dg-assistant-section-title">Indicateurs de performance</h2>
          <p className="dg-assistant-section-sub">Flux RDV, réservations de salles et répartition</p>
        </div>
      </div>

      <div className="dg-assistant-charts-grid">
        <ChartCard title="Flux RDV" subtitle="7 prochains jours — projection" hero>
          <div className="dg-assistant-chart-kicker">
            {flowPeak.total > 0 ? (
              <span>
                Pic : <strong>{flowPeak.total}</strong> RDV ({flowPeak.label})
              </span>
            ) : (
              <span>Charge modérée sur la période</span>
            )}
          </div>
          <ChartContainer config={flowConfig} className="dg-assistant-chart dg-assistant-chart--area-lg">
            <AreaChart data={charts.weeklyFlow} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="assistantApprovedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-approved)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-approved)" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="assistantPendingFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-pending)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--color-pending)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.3} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={4} width={26} fontSize={10} />
              <ChartTooltip
                cursor={{ stroke: 'var(--admin-border)', strokeWidth: 1 }}
                content={<ChartTooltipContent labelFormatter={flowTooltipLabel} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="approved"
                stroke="var(--color-approved)"
                strokeWidth={2.5}
                fill="url(#assistantApprovedFill)"
                dot={{ r: 3, fill: 'var(--color-approved)', strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="pending"
                stroke="var(--color-pending)"
                strokeWidth={2}
                fill="url(#assistantPendingFill)"
                dot={{ r: 2.5, fill: 'var(--color-pending)', strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ChartContainer>
        </ChartCard>

        <ChartCard title="Salle" subtitle="7 derniers jours">
          <div className="dg-assistant-chart-kicker">
            {roomPeak.total > 0 ? (
              <span>
                Pic : <strong>{roomPeak.total}</strong> réservation{roomPeak.total > 1 ? 's' : ''} ({roomPeak.label})
              </span>
            ) : (
              <span className="dg-assistant-chart-kicker--muted">Aucune réservation sur la période</span>
            )}
          </div>
          <div className={roomTotal === 0 ? 'dg-assistant-chart-room-wrap dg-assistant-chart-room-wrap--empty' : 'dg-assistant-chart-room-wrap'}>
            {roomTotal === 0 ? (
              <div className="dg-assistant-chart-empty-glyph" aria-hidden>
                <Building2 strokeWidth={1.25} />
              </div>
            ) : null}
            <ChartContainer config={roomTrendConfig} className="dg-assistant-chart dg-assistant-chart--bar-v">
              <BarChart data={charts.roomTrend} margin={{ top: 6, right: 4, left: -14, bottom: 2 }} barCategoryGap="18%">
                <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.25} />
                <XAxis
                  dataKey="shortLabel"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  fontSize={9}
                  interval={0}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tickMargin={4} width={22} fontSize={9} />
                <ChartTooltip
                  cursor={{ fill: 'color-mix(in oklch, var(--admin-hero-bg) 45%, transparent)' }}
                  content={<ChartTooltipContent labelFormatter={roomTooltipLabel} />}
                />
                <Bar dataKey="reunion" stackId="room" fill="var(--color-reunion)" maxBarSize={20} radius={[0, 0, 0, 0]} />
                <Bar dataKey="comite" stackId="room" fill="var(--color-comite)" maxBarSize={20} radius={[0, 0, 0, 0]} />
                <Bar dataKey="autres" stackId="room" fill="var(--color-autres)" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ChartContainer>
          </div>
          <ul className="dg-assistant-chart-legend dg-assistant-chart-legend--room">
            {roomTrendLegendKeys.map((key) => (
              <li key={key}>
                <span
                  className="dg-assistant-chart-legend-dot"
                  style={{ background: `var(--color-${key})` }}
                />
                <span>{roomTrendConfig[key].label}</span>
              </li>
            ))}
          </ul>
        </ChartCard>

        <ChartCard title="Répartition" subtitle="Tous les statuts">
          {statusTotal === 0 ? (
            <p className="dg-assistant-chart-empty">Aucun rendez-vous enregistré.</p>
          ) : (
            <ChartContainer config={statusConfig} className="dg-assistant-chart dg-assistant-chart--donut">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="key"
                  innerRadius="56%"
                  outerRadius="80%"
                  paddingAngle={4}
                  strokeWidth={2}
                  stroke="var(--admin-surface)"
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.key} fill={`var(--color-${entry.key})`} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null;
                      const { cx, cy } = viewBox;
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={cx} y={(cy ?? 0) - 4} className="fill-foreground text-base font-bold">
                            {statusTotal}
                          </tspan>
                          <tspan x={cx} y={(cy ?? 0) + 12} className="fill-muted-foreground text-[9px]">
                            RDV
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
          <ul className="dg-assistant-chart-legend">
            {charts.byStatus.map((item) => (
              <li key={item.key}>
                <span
                  className="dg-assistant-chart-legend-dot"
                  style={{ background: `var(--color-${item.key})` }}
                />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}
