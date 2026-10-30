'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CalendarCheck,
  Clock3,
  FileStack,
  Percent,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import {
  AppointmentComparisonPeriodBar,
  type ComparisonPeriodState,
} from '@/components/dg/appointment-comparison-period-bar';
import { useTemporalNavigation } from '@/components/temporal/temporal-navigation-context';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { AppointmentYearComparison, ComparisonRow } from '@/lib/dg/appointment-year-comparison';
import { defaultComparisonPeriods, periodsAreIdentical } from '@/lib/temporal/compare-period';
import { cn } from '@/lib/utils';

const compareBarConfig = {
  period1: { label: 'Période 1', color: 'oklch(0.55 0.08 260)' },
  period2: { label: 'Période 2', color: 'oklch(0.48 0.12 155)' },
} satisfies ChartConfig;

const lineConfig = compareBarConfig;

function CompareKpiCard({
  icon: Icon,
  label,
  value,
  period1Value,
  evolution,
  trend,
  accent,
}: {
  icon: typeof FileStack;
  label: string;
  value: string;
  period1Value?: string;
  evolution?: string;
  trend?: ComparisonRow['trend'];
  accent: 'blue' | 'green' | 'violet' | 'amber';
}) {
  return (
    <article className={cn('rdv-compare-kpi', `rdv-compare-kpi--${accent}`)}>
      <div className="rdv-compare-kpi__icon-wrap">
        <Icon className="rdv-compare-kpi__icon" strokeWidth={2} aria-hidden />
      </div>
      <div className="rdv-compare-kpi__body">
        <span className="rdv-compare-kpi-label">{label}</span>
        <div className="rdv-compare-kpi__values">
          <strong className="rdv-compare-kpi-value">{value}</strong>
          {period1Value != null ? (
            <span className="rdv-compare-kpi__ref">vs {period1Value}</span>
          ) : null}
        </div>
      </div>
      {evolution ? (
        <span
          className={cn(
            'rdv-compare-kpi__delta-pill',
            trend === 'up' && 'rdv-compare-kpi__delta-pill--up',
            trend === 'down' && 'rdv-compare-kpi__delta-pill--down',
            trend === 'improvement' && 'rdv-compare-kpi__delta-pill--up',
            trend === 'worse' && 'rdv-compare-kpi__delta-pill--down',
            trend === 'neutral' && 'rdv-compare-kpi__delta-pill--neutral'
          )}
        >
          <TrendIcon trend={trend ?? 'neutral'} />
          {evolution}
        </span>
      ) : null}
    </article>
  );
}

function CompareSummaryStrip({
  period1Label,
  period2Label,
  total1,
  total2,
}: {
  period1Label: string;
  period2Label: string;
  total1: number;
  total2: number;
}) {
  return (
    <div className="rdv-compare-summary">
      <span className="rdv-compare-summary__pill rdv-compare-summary__pill--p1">
        <span className="rdv-compare-summary__pill-tag">P1</span>
        <span className="rdv-compare-summary__pill-range">{period1Label}</span>
        <strong className="rdv-compare-summary__pill-stat">{total1}</strong>
      </span>
      <span className="rdv-compare-summary__vs" aria-hidden>
        vs
      </span>
      <span className="rdv-compare-summary__pill rdv-compare-summary__pill--p2">
        <span className="rdv-compare-summary__pill-tag">P2</span>
        <span className="rdv-compare-summary__pill-range">{period2Label}</span>
        <strong className="rdv-compare-summary__pill-stat">{total2}</strong>
      </span>
    </div>
  );
}

function CompareSkeleton() {
  return (
    <div className="rdv-compare-skeleton" aria-busy aria-label="Chargement des statistiques">
      <div className="rdv-compare-skeleton__summary" />
      <div className="rdv-compare-skeleton__kpis">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rdv-compare-skeleton__kpi" />
        ))}
      </div>
      <div className="rdv-compare-skeleton__table" />
      <div className="rdv-compare-skeleton__charts">
        <div className="rdv-compare-skeleton__chart rdv-compare-skeleton__chart--wide" />
        <div className="rdv-compare-skeleton__chart" />
        <div className="rdv-compare-skeleton__chart" />
      </div>
    </div>
  );
}

function TrendIcon({ trend }: { trend: ComparisonRow['trend'] }) {
  if (trend === 'up' || trend === 'improvement') {
    return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
  }
  if (trend === 'down' || trend === 'worse') {
    return <TrendingDown className="h-3.5 w-3.5 text-rose-600" aria-hidden />;
  }
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />;
}

function ComparisonTable({
  rows,
  period1Label,
  period2Label,
}: {
  rows: ComparisonRow[];
  period1Label: string;
  period2Label: string;
}) {
  return (
    <div className="rdv-compare-table-wrap">
      <table className="rdv-compare-table">
        <thead>
          <tr>
            <th>Indicateur</th>
            <th>
              <span className="rdv-compare-table-period-head">Période 1</span>
              <span className="rdv-compare-table-period-sub">{period1Label}</span>
            </th>
            <th>
              <span className="rdv-compare-table-period-head">Période 2</span>
              <span className="rdv-compare-table-period-sub">{period2Label}</span>
            </th>
            <th>Évolution</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              <td className="rdv-compare-table-num">{row.period1}</td>
              <td className="rdv-compare-table-num">{row.period2}</td>
              <td>
                <span
                  className={cn(
                    'rdv-compare-evolution-pill',
                    row.trend === 'up' && 'rdv-compare-evolution-pill--up',
                    row.trend === 'down' && 'rdv-compare-evolution-pill--down',
                    row.trend === 'improvement' && 'rdv-compare-evolution-pill--good',
                    row.trend === 'worse' && 'rdv-compare-evolution-pill--bad',
                    row.trend === 'neutral' && 'rdv-compare-evolution-pill--neutral'
                  )}
                >
                  <TrendIcon trend={row.trend} />
                  {row.evolution}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPieCard({
  title,
  periodLabel,
  slices,
}: {
  title: string;
  periodLabel: string;
  slices: AppointmentYearComparison['statusPiePeriod1'];
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const config = useMemo(() => {
    const c: ChartConfig = {};
    for (const s of slices) {
      c[s.key] = { label: s.label, color: s.color };
    }
    return c;
  }, [slices]);

  return (
    <article className="dg-assistant-chart-card">
      <header className="dg-assistant-chart-card-head">
        <h3 className="dg-assistant-chart-card-title">{title}</h3>
        <p className="dg-assistant-chart-card-sub">{periodLabel}</p>
      </header>
      <div className="dg-assistant-chart-card-body">
        {total === 0 ? (
          <p className="dg-assistant-chart-empty">Aucune donnée pour cette période.</p>
        ) : (
          <>
            <ChartContainer config={config} className="dg-assistant-chart dg-assistant-chart--donut">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="54%"
                  outerRadius="78%"
                  paddingAngle={3}
                  strokeWidth={2}
                  stroke="var(--admin-surface)"
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="dg-assistant-chart-legend">
              {slices.map((s) => (
                <li key={s.key}>
                  <span className="dg-assistant-chart-legend-dot" style={{ background: s.color }} />
                  <span>{s.label}</span>
                  <strong>{s.value}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}

function HeatmapGrid({
  title,
  periodLabel,
  cells,
}: {
  title: string;
  periodLabel: string;
  cells: AppointmentYearComparison['heatmapPeriod1'];
}) {
  const max = Math.max(1, ...cells.map((c) => c.value));
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const days = [0, 1, 2, 3, 4];

  return (
    <article className="dg-assistant-chart-card rdv-compare-heatmap-card">
      <header className="dg-assistant-chart-card-head">
        <h3 className="dg-assistant-chart-card-title">{title}</h3>
        <p className="dg-assistant-chart-card-sub">{periodLabel}</p>
      </header>
      <div className="dg-assistant-chart-card-body">
        <div className="rdv-compare-heatmap">
          <div className="rdv-compare-heatmap-corner" />
          {hours.map((h) => (
            <div key={h} className="rdv-compare-heatmap-hour">
              {h}h
            </div>
          ))}
          {days.map((day) => (
            <div key={day} className="rdv-compare-heatmap-row">
              <div className="rdv-compare-heatmap-day">
                {cells.find((c) => c.day === day)?.dayLabel}
              </div>
              {hours.map((hour) => {
                const cell = cells.find((c) => c.day === day && c.hour === hour);
                const value = cell?.value ?? 0;
                const intensity = value / max;
                return (
                  <div
                    key={`${day}-${hour}`}
                    className="rdv-compare-heatmap-cell"
                    style={{
                      background: `color-mix(in oklch, var(--admin-primary) ${Math.round(intensity * 85)}%, var(--admin-surface))`,
                    }}
                    title={`${cell?.dayLabel} ${hour}h — ${value} RDV`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function AppointmentYearComparisonView() {
  const { year: globalYear } = useTemporalNavigation();
  const [periods, setPeriods] = useState<ComparisonPeriodState>(() =>
    defaultComparisonPeriods(globalYear)
  );
  const [data, setData] = useState<AppointmentYearComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPeriods((prev) => ({
      period1: prev.period1,
      period2: defaultComparisonPeriods(globalYear).period2,
    }));
  }, [globalYear]);

  const samePeriod = periodsAreIdentical(periods.period1, periods.period2);

  const load = useCallback(async () => {
    if (samePeriod) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from1: periods.period1.fromDate,
        to1: periods.period1.toDate,
        from2: periods.period2.fromDate,
        to2: periods.period2.toDate,
      });
      const res = await fetch(`/api/dg/appointments/comparison?${params.toString()}`);
      if (res.ok) {
        setData((await res.json()) as AppointmentYearComparison);
      } else {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [periods, samePeriod]);

  useEffect(() => {
    void load();
  }, [load]);

  const deptChartData = useMemo(
    () =>
      data?.byDepartment.map((d) => ({
        name: d.department.length > 18 ? `${d.department.slice(0, 16)}…` : d.department,
        fullName: d.department,
        period1: d.period1,
        period2: d.period2,
      })) ?? [],
    [data]
  );

  const period1Legend = data?.period1Meta.label ?? periods.period1.label;
  const period2Legend = data?.period2Meta.label ?? periods.period2.label;

  const row = (key: ComparisonRow['key']) => data?.rows.find((r) => r.key === key);

  return (
    <div className="app-page admin-theme admin-appt-page admin-appt-page--compact rdv-compare-page rdv-compare-page--compact">
      <AppointmentComparisonPeriodBar
        referenceYear={globalYear}
        value={periods}
        onChange={setPeriods}
      />

      {samePeriod ? (
        <p className="rdv-compare-empty">Choisissez deux périodes distinctes pour comparer les statistiques.</p>
      ) : loading ? (
        <CompareSkeleton />
      ) : !data ? (
        <p className="rdv-compare-empty">Impossible de charger l&apos;analyse comparative.</p>
      ) : (
        <>
          <CompareSummaryStrip
            period1Label={period1Legend}
            period2Label={period2Legend}
            total1={data.period1.totalRequests}
            total2={data.period2.totalRequests}
          />

          <section className="rdv-compare-kpis">
            <CompareKpiCard
              icon={FileStack}
              accent="blue"
              label="Demandes"
              value={String(data.period2.totalRequests)}
              period1Value={String(data.period1.totalRequests)}
              evolution={row('totalRequests')?.evolution}
              trend={row('totalRequests')?.trend}
            />
            <CompareKpiCard
              icon={Percent}
              accent="green"
              label="Taux de validation"
              value={`${String(data.period2.validationRate).replace('.', ',')} %`}
              period1Value={`${String(data.period1.validationRate).replace('.', ',')} %`}
              evolution={row('validationRate')?.evolution}
              trend={row('validationRate')?.trend}
            />
            <CompareKpiCard
              icon={CalendarCheck}
              accent="violet"
              label="RDV réalisés"
              value={String(data.period2.realized)}
              period1Value={String(data.period1.realized)}
              evolution={row('realized')?.evolution}
              trend={row('realized')?.trend}
            />
            <CompareKpiCard
              icon={Clock3}
              accent="amber"
              label="Délai moyen"
              value={
                data.period2.avgProcessingDays != null
                  ? `${String(data.period2.avgProcessingDays).replace('.', ',')} j`
                  : '—'
              }
              period1Value={
                data.period1.avgProcessingDays != null
                  ? `${String(data.period1.avgProcessingDays).replace('.', ',')} j`
                  : '—'
              }
              evolution={row('avgProcessingDays')?.evolution}
              trend={row('avgProcessingDays')?.trend}
            />
          </section>

          <section className="rdv-compare-panel">
            <header className="rdv-compare-panel__head">
              <h2 className="rdv-compare-section-title">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                Tableau comparatif
              </h2>
            </header>
            <ComparisonTable
              rows={data.rows}
              period1Label={period1Legend}
              period2Label={period2Legend}
            />
          </section>

          <section className="rdv-compare-panel">
            <header className="rdv-compare-panel__head">
              <h2 className="rdv-compare-section-title">Graphiques</h2>
            </header>
            <div className="dg-assistant-charts-grid rdv-compare-charts-grid">
              <article className="dg-assistant-chart-card dg-assistant-chart-card--hero">
                <header className="dg-assistant-chart-card-head">
                  <h3 className="dg-assistant-chart-card-title">Histogramme mensuel</h3>
                  <p className="dg-assistant-chart-card-sub">
                    Demandes par mois — {period1Legend} vs {period2Legend}
                  </p>
                </header>
                <div className="dg-assistant-chart-card-body">
                  <ChartContainer config={compareBarConfig} className="dg-assistant-chart dg-assistant-chart--bar-v">
                    <BarChart data={data.monthlyHistogram} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={10} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar dataKey="period1" name="Période 1" fill="var(--color-period1)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                      <Bar dataKey="period2" name="Période 2" fill="var(--color-period2)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </article>

              <article className="dg-assistant-chart-card">
                <header className="dg-assistant-chart-card-head">
                  <h3 className="dg-assistant-chart-card-title">Évolution mensuelle</h3>
                  <p className="dg-assistant-chart-card-sub">Courbe des demandes</p>
                </header>
                <div className="dg-assistant-chart-card-body">
                  <ChartContainer config={lineConfig} className="dg-assistant-chart dg-assistant-chart--area">
                    <LineChart data={data.monthlyCurve} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={10} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line type="monotone" dataKey="period1" name="Période 1" stroke="var(--color-period1)" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="period2" name="Période 2" stroke="var(--color-period2)" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ChartContainer>
                </div>
              </article>

              <StatusPieCard title="Répartition statuts" periodLabel={period1Legend} slices={data.statusPiePeriod1} />
              <StatusPieCard title="Répartition statuts" periodLabel={period2Legend} slices={data.statusPiePeriod2} />

              <article className="dg-assistant-chart-card rdv-compare-dept-card">
                <header className="dg-assistant-chart-card-head">
                  <h3 className="dg-assistant-chart-card-title">Par direction / département</h3>
                  <p className="dg-assistant-chart-card-sub">Volume de demandes par structure</p>
                </header>
                <div className="dg-assistant-chart-card-body">
                  <ChartContainer config={compareBarConfig} className="dg-assistant-chart dg-assistant-chart--bar-v">
                    <BarChart
                      layout="vertical"
                      data={deptChartData}
                      margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" strokeOpacity={0.3} />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={10} />
                      <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={88} fontSize={9} />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(_, payload) =>
                              String(payload?.[0]?.payload?.fullName ?? '')
                            }
                          />
                        }
                      />
                      <Legend />
                      <Bar dataKey="period1" name="Période 1" fill="var(--color-period1)" radius={[0, 4, 4, 0]} maxBarSize={14} />
                      <Bar dataKey="period2" name="Période 2" fill="var(--color-period2)" radius={[0, 4, 4, 0]} maxBarSize={14} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </article>

              <HeatmapGrid title="Heatmap — sollicitation" periodLabel={period1Legend} cells={data.heatmapPeriod1} />
              <HeatmapGrid title="Heatmap — sollicitation" periodLabel={period2Legend} cells={data.heatmapPeriod2} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
