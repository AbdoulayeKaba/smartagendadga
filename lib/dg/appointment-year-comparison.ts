import {
  type ComparePeriodRange,
  combinedPeriodBounds,
  inPeriod,
  yearToPeriodRange,
} from '@/lib/temporal/compare-period';
import { yearRange } from '@/lib/temporal/year-range';

export type AppointmentYearRaw = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  reviewedAt: Date | null;
  startAt: Date;
  rejectionReason: string | null;
  department: string | null;
};

export type AuditRescheduleRaw = {
  appointmentId: string | null;
  createdAt: Date;
};

export type YearPeriodStats = {
  year: number;
  totalRequests: number;
  validated: number;
  rejected: number;
  rescheduled: number;
  realized: number;
  cancelled: number;
  avgProcessingDays: number | null;
  validationRate: number;
};

export type ComparisonIndicatorKey =
  | 'totalRequests'
  | 'validated'
  | 'rejected'
  | 'rescheduled'
  | 'realized'
  | 'cancelled'
  | 'avgProcessingDays'
  | 'validationRate';

export type ComparisonRow = {
  key: ComparisonIndicatorKey;
  label: string;
  period1: string;
  period2: string;
  evolution: string;
  trend: 'up' | 'down' | 'neutral' | 'improvement' | 'worse';
};

export type MonthlyComparePoint = {
  month: number;
  label: string;
  period1: number;
  period2: number;
};

export type StatusSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export type DepartmentComparePoint = {
  department: string;
  period1: number;
  period2: number;
};

export type HeatmapCell = {
  day: number;
  dayLabel: string;
  hour: number;
  value: number;
};

export type PeriodMeta = {
  fromDate: string;
  toDate: string;
  label: string;
};

export type AppointmentYearComparison = {
  year1: number;
  year2: number;
  period1Meta: PeriodMeta;
  period2Meta: PeriodMeta;
  period1: YearPeriodStats;
  period2: YearPeriodStats;
  rows: ComparisonRow[];
  monthlyHistogram: MonthlyComparePoint[];
  monthlyCurve: MonthlyComparePoint[];
  statusPiePeriod1: StatusSlice[];
  statusPiePeriod2: StatusSlice[];
  byDepartment: DepartmentComparePoint[];
  heatmapPeriod1: HeatmapCell[];
  heatmapPeriod2: HeatmapCell[];
};

const MONTH_LABELS = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function inYear(d: Date, year: number): boolean {
  return d.getFullYear() === year;
}

function isCancelledReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return /annul/i.test(reason);
}

function toPeriodMeta(range: ComparePeriodRange): PeriodMeta {
  return { fromDate: range.fromDate, toDate: range.toDate, label: range.label };
}

export function computePeriodStats(
  range: ComparePeriodRange,
  appointments: AppointmentYearRaw[],
  reschedules: AuditRescheduleRaw[],
  now = new Date()
): YearPeriodStats {
  const inRangeAppts = appointments.filter((a) => inPeriod(a.createdAt, range.from, range.to));

  const validated = inRangeAppts.filter((a) => a.status === 'APPROVED').length;
  const rejectedRows = inRangeAppts.filter(
    (a) => a.status === 'REJECTED' && !isCancelledReason(a.rejectionReason)
  );
  const cancelledRows = inRangeAppts.filter(
    (a) => a.status === 'REJECTED' && isCancelledReason(a.rejectionReason)
  );
  const rejected = rejectedRows.length;
  const cancelled = cancelledRows.length;

  const rescheduled = reschedules.filter((r) => inPeriod(r.createdAt, range.from, range.to)).length;

  const realized = inRangeAppts.filter(
    (a) =>
      a.status === 'APPROVED' &&
      inPeriod(a.startAt, range.from, range.to) &&
      a.startAt <= now
  ).length;

  const decided = inRangeAppts.filter((a) => a.status !== 'PENDING' && a.reviewedAt);
  const processingMs = decided
    .map((a) => (a.reviewedAt!.getTime() - a.createdAt.getTime()) / 86_400_000)
    .filter((d) => d >= 0);
  const avgProcessingDays =
    processingMs.length > 0
      ? Math.round((processingMs.reduce((s, v) => s + v, 0) / processingMs.length) * 10) / 10
      : null;

  const decidedCount = validated + rejected + cancelled;
  const validationRate =
    decidedCount > 0 ? Math.round((validated / decidedCount) * 1000) / 10 : 0;

  return {
    year: range.year,
    totalRequests: inRangeAppts.length,
    validated,
    rejected,
    rescheduled,
    realized,
    cancelled,
    avgProcessingDays,
    validationRate,
  };
}

export function computeYearStats(
  year: number,
  appointments: AppointmentYearRaw[],
  reschedules: AuditRescheduleRaw[],
  now = new Date()
): YearPeriodStats {
  return computePeriodStats(yearToPeriodRange(year), appointments, reschedules, now);
}

function formatEvolutionPercent(v1: number, v2: number): { text: string; trend: ComparisonRow['trend'] } {
  if (v1 === 0 && v2 === 0) return { text: '—', trend: 'neutral' };
  if (v1 === 0) return { text: '+100 %', trend: 'up' };
  const pct = ((v2 - v1) / v1) * 100;
  const sign = pct > 0 ? '+' : '';
  return {
    text: `${sign}${pct.toFixed(1).replace('.', ',')} %`,
    trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
  };
}

function formatPointsEvolution(v1: number, v2: number): { text: string; trend: ComparisonRow['trend'] } {
  const diff = Math.round((v2 - v1) * 10) / 10;
  if (diff === 0) return { text: '—', trend: 'neutral' };
  const sign = diff > 0 ? '+' : '';
  return {
    text: `${sign}${String(diff).replace('.', ',')} point${Math.abs(diff) >= 2 ? 's' : ''}`,
    trend: diff > 0 ? 'up' : 'down',
  };
}

function formatDaysEvolution(
  v1: number | null,
  v2: number | null
): { text: string; trend: ComparisonRow['trend'] } {
  if (v1 == null || v2 == null) return { text: '—', trend: 'neutral' };
  if (v2 < v1) return { text: 'Amélioration', trend: 'improvement' };
  if (v2 > v1) return { text: 'Dégradation', trend: 'worse' };
  return { text: 'Stable', trend: 'neutral' };
}

function buildRows(p1: YearPeriodStats, p2: YearPeriodStats): ComparisonRow[] {
  const fmtDays = (d: number | null) => (d == null ? '—' : `${String(d).replace('.', ',')} jour${d > 1 ? 's' : ''}`);
  const fmtRate = (r: number) => `${String(r).replace('.', ',')} %`;

  const defs: {
    key: ComparisonIndicatorKey;
    label: string;
    v1: number | null;
    v2: number | null;
    display1: string;
    display2: string;
    evolve: () => { text: string; trend: ComparisonRow['trend'] };
  }[] = [
    {
      key: 'totalRequests',
      label: 'Nombre total de demandes',
      v1: p1.totalRequests,
      v2: p2.totalRequests,
      display1: String(p1.totalRequests),
      display2: String(p2.totalRequests),
      evolve: () => formatEvolutionPercent(p1.totalRequests, p2.totalRequests),
    },
    {
      key: 'validated',
      label: 'Rendez-vous validés',
      v1: p1.validated,
      v2: p2.validated,
      display1: String(p1.validated),
      display2: String(p2.validated),
      evolve: () => formatEvolutionPercent(p1.validated, p2.validated),
    },
    {
      key: 'rejected',
      label: 'Rendez-vous refusés',
      v1: p1.rejected,
      v2: p2.rejected,
      display1: String(p1.rejected),
      display2: String(p2.rejected),
      evolve: () => formatEvolutionPercent(p1.rejected, p2.rejected),
    },
    {
      key: 'rescheduled',
      label: 'Rendez-vous reportés',
      v1: p1.rescheduled,
      v2: p2.rescheduled,
      display1: String(p1.rescheduled),
      display2: String(p2.rescheduled),
      evolve: () => formatEvolutionPercent(p1.rescheduled, p2.rescheduled),
    },
    {
      key: 'realized',
      label: 'Rendez-vous réalisés',
      v1: p1.realized,
      v2: p2.realized,
      display1: String(p1.realized),
      display2: String(p2.realized),
      evolve: () => formatEvolutionPercent(p1.realized, p2.realized),
    },
    {
      key: 'cancelled',
      label: 'Rendez-vous annulés',
      v1: p1.cancelled,
      v2: p2.cancelled,
      display1: String(p1.cancelled),
      display2: String(p2.cancelled),
      evolve: () => formatEvolutionPercent(p1.cancelled, p2.cancelled),
    },
    {
      key: 'avgProcessingDays',
      label: 'Temps moyen de traitement',
      v1: p1.avgProcessingDays,
      v2: p2.avgProcessingDays,
      display1: fmtDays(p1.avgProcessingDays),
      display2: fmtDays(p2.avgProcessingDays),
      evolve: () => formatDaysEvolution(p1.avgProcessingDays, p2.avgProcessingDays),
    },
    {
      key: 'validationRate',
      label: 'Taux de validation',
      v1: p1.validationRate,
      v2: p2.validationRate,
      display1: fmtRate(p1.validationRate),
      display2: fmtRate(p2.validationRate),
      evolve: () => formatPointsEvolution(p1.validationRate, p2.validationRate),
    },
  ];

  return defs.map((d) => {
    const ev = d.evolve();
    return {
      key: d.key,
      label: d.label,
      period1: d.display1,
      period2: d.display2,
      evolution: ev.text,
      trend: ev.trend,
    };
  });
}

function monthlyCounts(appointments: AppointmentYearRaw[], year: number): number[] {
  const counts = Array.from({ length: 12 }, () => 0);
  for (const a of appointments) {
    if (inYear(a.createdAt, year)) {
      counts[a.createdAt.getMonth()] += 1;
    }
  }
  return counts;
}

function monthlySeriesInPeriod(
  appointments: AppointmentYearRaw[],
  range: ComparePeriodRange
): { label: string; count: number }[] {
  const points: { label: string; count: number }[] = [];
  let cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);

  while (cursor.getTime() <= range.to.getTime()) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const sliceFrom = monthStart < range.from ? range.from : monthStart;
    const sliceTo = monthEnd > range.to ? range.to : monthEnd;
    const count = appointments.filter((a) => inPeriod(a.createdAt, sliceFrom, sliceTo)).length;
    const label = `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    points.push({ label, count });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return points;
}

function mergeMonthlySeries(
  series1: { label: string; count: number }[],
  series2: { label: string; count: number }[]
): MonthlyComparePoint[] {
  const maxLen = Math.max(series1.length, series2.length, 1);
  return Array.from({ length: maxLen }, (_, i) => ({
    month: i + 1,
    label: series1[i]?.label ?? series2[i]?.label ?? `M${i + 1}`,
    period1: series1[i]?.count ?? 0,
    period2: series2[i]?.count ?? 0,
  }));
}

function statusPie(stats: YearPeriodStats): StatusSlice[] {
  return [
    { key: 'validated', label: 'Validé', value: stats.validated, color: 'oklch(0.48 0.12 155)' },
    { key: 'rejected', label: 'Refusé', value: stats.rejected, color: 'oklch(0.58 0.18 25)' },
    { key: 'rescheduled', label: 'Reporté', value: stats.rescheduled, color: 'oklch(0.62 0.14 75)' },
    { key: 'cancelled', label: 'Annulé', value: stats.cancelled, color: 'oklch(0.52 0.02 260)' },
  ].filter((s) => s.value > 0);
}

function departmentCounts(
  appointments: AppointmentYearRaw[],
  range: ComparePeriodRange
): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of appointments) {
    if (!inPeriod(a.createdAt, range.from, range.to)) continue;
    const dept = a.department?.trim() || 'Non renseigné';
    map.set(dept, (map.get(dept) ?? 0) + 1);
  }
  return map;
}

function buildHeatmap(appointments: AppointmentYearRaw[], range: ComparePeriodRange): HeatmapCell[] {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const a of appointments) {
    if (!inPeriod(a.startAt, range.from, range.to)) continue;
    const day = (a.startAt.getDay() + 6) % 7;
    const hour = a.startAt.getHours();
    grid[day]![hour]! += 1;
  }
  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      cells.push({
        day,
        dayLabel: DAY_LABELS[day]!,
        hour,
        value: grid[day]![hour]!,
      });
    }
  }
  return cells;
}

export function buildAppointmentPeriodComparison(
  range1: ComparePeriodRange,
  range2: ComparePeriodRange,
  appointments: AppointmentYearRaw[],
  reschedules: AuditRescheduleRaw[],
  now = new Date()
): AppointmentYearComparison {
  const period1 = computePeriodStats(range1, appointments, reschedules, now);
  const period2 = computePeriodStats(range2, appointments, reschedules, now);

  const isFullYear1 =
    range1.fromDate.endsWith('-01-01') && range1.toDate === `${range1.year}-12-31`;
  const isFullYear2 =
    range2.fromDate.endsWith('-01-01') && range2.toDate === `${range2.year}-12-31`;

  let monthlyHistogram: MonthlyComparePoint[];
  if (isFullYear1 && isFullYear2) {
    const m1 = monthlyCounts(appointments, range1.year);
    const m2 = monthlyCounts(appointments, range2.year);
    monthlyHistogram = MONTH_LABELS.map((label, i) => ({
      month: i + 1,
      label,
      period1: m1[i]!,
      period2: m2[i]!,
    }));
  } else {
    monthlyHistogram = mergeMonthlySeries(
      monthlySeriesInPeriod(appointments, range1),
      monthlySeriesInPeriod(appointments, range2)
    );
  }

  const d1 = departmentCounts(appointments, range1);
  const d2 = departmentCounts(appointments, range2);
  const departments = [...new Set([...d1.keys(), ...d2.keys()])].sort(
    (a, b) => (d2.get(b) ?? 0) + (d1.get(b) ?? 0) - ((d2.get(a) ?? 0) + (d1.get(a) ?? 0))
  );

  return {
    year1: range1.year,
    year2: range2.year,
    period1Meta: toPeriodMeta(range1),
    period2Meta: toPeriodMeta(range2),
    period1,
    period2,
    rows: buildRows(period1, period2),
    monthlyHistogram,
    monthlyCurve: monthlyHistogram,
    statusPiePeriod1: statusPie(period1),
    statusPiePeriod2: statusPie(period2),
    byDepartment: departments.slice(0, 8).map((department) => ({
      department,
      period1: d1.get(department) ?? 0,
      period2: d2.get(department) ?? 0,
    })),
    heatmapPeriod1: buildHeatmap(appointments, range1),
    heatmapPeriod2: buildHeatmap(appointments, range2),
  };
}

export function buildAppointmentYearComparison(
  year1: number,
  year2: number,
  appointments: AppointmentYearRaw[],
  reschedules: AuditRescheduleRaw[],
  now = new Date()
): AppointmentYearComparison {
  return buildAppointmentPeriodComparison(
    yearToPeriodRange(year1),
    yearToPeriodRange(year2),
    appointments,
    reschedules,
    now
  );
}

/** Jeu de démonstration quand les données réelles sont insuffisantes (mode mock). */
export function buildDemoAppointmentComparison(
  range1: ComparePeriodRange,
  range2: ComparePeriodRange
): AppointmentYearComparison {
  const year1 = range1.year;
  const year2 = range2.year;
  const period1: YearPeriodStats = {
    year: year1,
    totalRequests: 320,
    validated: 280,
    rejected: 25,
    rescheduled: 15,
    realized: 260,
    cancelled: 20,
    avgProcessingDays: 2.5,
    validationRate: 87.5,
  };
  const period2: YearPeriodStats = {
    year: year2,
    totalRequests: 410,
    validated: 365,
    rejected: 18,
    rescheduled: 27,
    realized: 350,
    cancelled: 15,
    avgProcessingDays: 1.4,
    validationRate: 89.0,
  };

  const monthlyHistogram: MonthlyComparePoint[] = MONTH_LABELS.map((label, i) => {
    const base1 = 18 + (i % 5) * 4 + Math.floor(i / 3);
    const base2 = 22 + (i % 4) * 5 + Math.floor(i / 2);
    return { month: i + 1, label, period1: base1 + (i === 7 ? -6 : 0), period2: base2 + (i === 11 ? 8 : 0) };
  });

  const statusPiePeriod1 = statusPie(period1);
  const statusPiePeriod2 = statusPie(period2);

  const byDepartment: DepartmentComparePoint[] = [
    { department: 'Direction Générale Adjointe', period1: 85, period2: 102 },
    { department: 'Secrétariat DGA', period1: 72, period2: 88 },
    { department: 'Ressources Humaines', period1: 48, period2: 61 },
    { department: 'Finances', period1: 41, period2: 55 },
    { department: 'Partenaires externes', period1: 38, period2: 52 },
    { department: 'Non renseigné', period1: 36, period2: 52 },
  ];

  const heat = (year: number, factor: number): HeatmapCell[] => {
    const cells: HeatmapCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        let value = 0;
        if (day < 5 && hour >= 8 && hour <= 17) {
          value = Math.round((3 + (hour % 4) + day) * factor);
          if (hour === 12) value = Math.max(1, value - 2);
        }
        if (year === year2 && day === 2 && hour === 10) value += 2;
        cells.push({ day, dayLabel: DAY_LABELS[day]!, hour, value });
      }
    }
    return cells;
  };

  return {
    year1,
    year2,
    period1Meta: toPeriodMeta(range1),
    period2Meta: toPeriodMeta(range2),
    period1,
    period2,
    rows: buildRows(period1, period2),
    monthlyHistogram,
    monthlyCurve: monthlyHistogram,
    statusPiePeriod1,
    statusPiePeriod2,
    byDepartment,
    heatmapPeriod1: heat(year1, 1),
    heatmapPeriod2: heat(year2, 1.15),
  };
}

export function yearBoundsForComparison(year1: number, year2: number) {
  const a = yearRange(Math.min(year1, year2));
  const b = yearRange(Math.max(year1, year2));
  return { from: a.from, to: b.to };
}

export function periodBoundsForComparison(
  range1: ComparePeriodRange,
  range2: ComparePeriodRange
) {
  return combinedPeriodBounds(range1, range2);
}
