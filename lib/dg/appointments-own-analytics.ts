import type { AppointmentStatus, AppointmentType, Priority } from '@prisma/client';
import type { UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import {
  APPOINTMENT_PRIORITY_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
  APPOINTMENT_URGENCY_LABELS,
  type AppointmentReviewItem,
} from '@/lib/dg/appointments-review';

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
] as const;

export const APPOINTMENT_STATUS_CHART_COLORS: Record<AppointmentStatus, string> = {
  PENDING: 'oklch(0.72 0.14 75)',
  APPROVED: 'oklch(0.48 0.12 155)',
  REJECTED: 'oklch(0.58 0.18 25)',
};

export const APPOINTMENT_STATUS_FLOW_ORDER: AppointmentStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
];

const URGENCY_CHART_COLORS: Record<UrgencyLevel, string> = {
  NORMAL: 'oklch(0.62 0.04 155)',
  URGENT: 'oklch(0.72 0.14 75)',
  TRES_URGENT: 'oklch(0.65 0.16 45)',
  CRITIQUE: 'oklch(0.55 0.2 25)',
};

const TYPE_CHART_COLORS: Record<AppointmentType, string> = {
  INTERNAL: 'oklch(0.48 0.12 155)',
  EXTERNAL: 'oklch(0.52 0.1 240)',
  MINISTRY: 'oklch(0.58 0.12 300)',
  PERSONAL: 'oklch(0.68 0.08 200)',
};

export type AppointmentStatusChartPoint = {
  key: AppointmentStatus;
  label: string;
  value: number;
  fill: string;
};

export type AppointmentMonthlyPoint = {
  month: number;
  label: string;
  total: number;
} & Record<AppointmentStatus, number>;

export type AppointmentCategoryPoint = {
  key: string;
  label: string;
  value: number;
  fill: string;
};

export type AppointmentsOwnAnalytics = {
  byStatus: AppointmentStatusChartPoint[];
  byUrgency: AppointmentCategoryPoint[];
  byType: AppointmentCategoryPoint[];
  byPriority: AppointmentCategoryPoint[];
  monthlyFlow: AppointmentMonthlyPoint[];
  total: number;
  pendingCount: number;
  approvedCount: number;
  approvalRate: number;
  year: number;
};

function resolveChartYear(items: AppointmentReviewItem[], preferredYear?: number): number {
  if (preferredYear && Number.isFinite(preferredYear)) return preferredYear;
  if (items.length === 0) return new Date().getFullYear();
  const counts = new Map<number, number>();
  for (const item of items) {
    const y = new Date(item.startAt).getFullYear();
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  let best = new Date().getFullYear();
  let bestN = -1;
  for (const [y, n] of counts) {
    if (n > bestN) {
      best = y;
      bestN = n;
    }
  }
  return best;
}

export function computeAppointmentsOwnAnalytics(
  items: AppointmentReviewItem[],
  preferredYear?: number
): AppointmentsOwnAnalytics {
  const year = resolveChartYear(items, preferredYear);
  const inYear = items.filter((item) => new Date(item.startAt).getFullYear() === year);

  const byStatus: AppointmentStatusChartPoint[] = APPOINTMENT_STATUS_FLOW_ORDER.map((key) => ({
    key,
    label: APPOINTMENT_STATUS_LABELS[key],
    value: inYear.filter((item) => item.status === key).length,
    fill: APPOINTMENT_STATUS_CHART_COLORS[key],
  })).filter((row) => row.value > 0);

  const urgencyOrder: UrgencyLevel[] = ['CRITIQUE', 'TRES_URGENT', 'URGENT', 'NORMAL'];
  const byUrgency = urgencyOrder
    .map((key) => ({
      key,
      label: APPOINTMENT_URGENCY_LABELS[key],
      value: inYear.filter((item) => item.urgencyLevel === key).length,
      fill: URGENCY_CHART_COLORS[key],
    }))
    .filter((row) => row.value > 0);

  const typeOrder: AppointmentType[] = ['INTERNAL', 'EXTERNAL', 'MINISTRY', 'PERSONAL'];
  const byType = typeOrder
    .map((key) => ({
      key,
      label: APPOINTMENT_TYPE_LABELS[key],
      value: inYear.filter((item) => item.type === key).length,
      fill: TYPE_CHART_COLORS[key],
    }))
    .filter((row) => row.value > 0);

  const priorityOrder: Priority[] = ['HIGH', 'MEDIUM', 'LOW'];
  const priorityColors: Record<Priority, string> = {
    HIGH: 'oklch(0.55 0.18 25)',
    MEDIUM: 'oklch(0.72 0.14 75)',
    LOW: 'oklch(0.58 0.06 220)',
  };
  const byPriority = priorityOrder
    .map((key) => ({
      key,
      label: APPOINTMENT_PRIORITY_LABELS[key],
      value: inYear.filter((item) => item.priority === key).length,
      fill: priorityColors[key],
    }))
    .filter((row) => row.value > 0);

  const monthlyFlow: AppointmentMonthlyPoint[] = Array.from({ length: 12 }, (_, month) => {
    const inMonth = inYear.filter((item) => new Date(item.startAt).getMonth() === month);
    const byStatusMonth = Object.fromEntries(
      APPOINTMENT_STATUS_FLOW_ORDER.map((key) => [
        key,
        inMonth.filter((item) => item.status === key).length,
      ])
    ) as Record<AppointmentStatus, number>;

    return {
      month,
      label: MONTH_LABELS[month]!,
      total: inMonth.length,
      ...byStatusMonth,
    };
  });

  const total = inYear.length;
  const approvedCount = inYear.filter((item) => item.status === 'APPROVED').length;
  const pendingCount = inYear.filter((item) => item.status === 'PENDING').length;

  return {
    byStatus,
    byUrgency,
    byType,
    byPriority,
    monthlyFlow,
    total,
    pendingCount,
    approvedCount,
    approvalRate: total > 0 ? Math.round((approvedCount / total) * 100) : 0,
    year,
  };
}
